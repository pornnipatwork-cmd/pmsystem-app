import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit, canAccessProject } from '@/lib/permissions'
import { parseExcelFile, extractMonthYearFromFilename } from '@/lib/excel-parser'
import { calculateStatus } from '@/lib/status'

// ให้ Vercel รัน function ได้นานสูงสุด 60 วินาที (Hobby tier max)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !canEdit(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file and projectId required' }, { status: 400 })
  }

  // ตรวจนามสกุลไฟล์ — รับเฉพาะ .xlsx / .xls
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return NextResponse.json(
      { error: 'รูปแบบไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ Excel (.xlsx หรือ .xls) ตามรูปแบบ PM Monthly Plan เท่านั้น' },
      { status: 400 }
    )
  }

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Extract month/year from filename
  const monthYear = extractMonthYearFromFilename(file.name)
  const month = monthYear?.month ?? new Date().getMonth() + 1
  const year = monthYear?.year ?? new Date().getFullYear()

  // ตรวจสอบไฟล์ซ้ำ — ห้ามนำเข้าชื่อไฟล์เดิมที่สำเร็จแล้ว
  const existingFile = await prisma.importFile.findFirst({
    where: { projectId, fileName: file.name, status: 'SUCCESS' },
  })
  if (existingFile) {
    return NextResponse.json(
      { error: `ไฟล์ "${file.name}" ถูกนำเข้าแล้ว ไม่สามารถนำเข้าซ้ำได้` },
      { status: 409 }
    )
  }

  // Create import file record
  const importFile = await prisma.importFile.create({
    data: {
      projectId,
      fileName: file.name,
      month,
      year,
      importedById: session.user.id,
      status: 'PENDING',
    },
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseResult = await parseExcelFile(Buffer.from(await file.arrayBuffer()) as any)

    // ตรวจ format: ต้องมี Sheet EE หรือ ME และต้องมีข้อมูลอย่างน้อย 1 รายการ
    const missingBothSheets = parseResult.errors.some(e => e.includes('EE')) &&
                              parseResult.errors.some(e => e.includes('ME'))
    if (parseResult.items.length === 0) {
      await prisma.importFile.update({
        where: { id: importFile.id },
        data: { status: 'FAILED', errorMsg: 'ไฟล์ไม่ตรงรูปแบบ PM Monthly Plan' },
      })
      const reason = missingBothSheets
        ? 'ไม่พบ Sheet "EE" และ "ME" ในไฟล์ กรุณาใช้ไฟล์ PM Monthly Plan ที่มี Sheet EE และ ME เท่านั้น'
        : 'ไม่พบรายการใดในไฟล์ กรุณาตรวจสอบรูปแบบไฟล์ PM Monthly Plan'
      return NextResponse.json({ error: reason }, { status: 422 })
    }

    // ── PMItems: parallel batch 20 (เร็วกว่า sequential ~6x) ──────────────
    let createdItems = 0
    const scheduleRows: { pmItemId: string; scheduledDate: Date; status: string }[] = []
    const ITEM_BATCH = 20

    for (let i = 0; i < parseResult.items.length; i += ITEM_BATCH) {
      const batch = parseResult.items.slice(i, i + ITEM_BATCH)
      const upsertedItems = await Promise.all(
        batch.map(item =>
          prisma.pMItem.upsert({
            where: { projectId_type_number: { projectId, type: item.type, number: item.number } },
            create: {
              projectId,
              importedFileId: importFile.id,
              type: item.type,
              category: item.category,
              subCategory: item.subCategory,
              no: item.no,
              name: item.name,
              number: item.number,
              location: item.location,
              period: item.period,
            },
            update: {
              category: item.category,
              subCategory: item.subCategory,
              name: item.name,
              location: item.location,
              period: item.period,
            },
          })
        )
      )
      createdItems += upsertedItems.length

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]
        const pmItem = upsertedItems[j]
        for (const day of item.scheduleDays) {
          const scheduledDate = new Date(Date.UTC(year, month - 1, day))
          const status = calculateStatus({ scheduledDate })
          scheduleRows.push({ pmItemId: pmItem.id, scheduledDate, status })
        }
      }
    }

    // ── PMSchedules: Turso Pipeline API (INSERT OR IGNORE ทั้งหมดใน 1-2 HTTP call) ──
    // เร็วกว่า Prisma upsert loop มาก — 3000 rows ส่งใน ~3 HTTP requests แทน 3000 requests
    let createdSchedules = 0

    if (scheduleRows.length > 0) {
      const isTurso = !!process.env.TURSO_DATABASE_URL

      if (isTurso) {
        // Production (Turso): ใช้ HTTP pipeline API
        const tursoUrl = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://')
        const tursoToken = process.env.TURSO_AUTH_TOKEN!
        const PIPELINE_CHUNK = 500 // 500 statements ต่อ HTTP call

        for (let i = 0; i < scheduleRows.length; i += PIPELINE_CHUNK) {
          const chunk = scheduleRows.slice(i, i + PIPELINE_CHUNK)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const requests: any[] = chunk.map(row => ({
            type: 'execute',
            stmt: {
              sql: 'INSERT OR IGNORE INTO PMSchedule (id, pmItemId, scheduledDate, status) VALUES (?, ?, ?, ?)',
              args: [
                { type: 'text', value: crypto.randomUUID() },
                { type: 'text', value: row.pmItemId },
                { type: 'text', value: row.scheduledDate.toISOString() },
                { type: 'text', value: row.status },
              ],
            },
          }))
          requests.push({ type: 'close' })

          const res = await fetch(`${tursoUrl}/v2/pipeline`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tursoToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requests }),
          })

          if (!res.ok) {
            const errText = await res.text()
            throw new Error(`Turso pipeline error: ${errText}`)
          }
          createdSchedules += chunk.length
        }
      } else {
        // Local dev (SQLite): Prisma upsert batch (no network latency → ไม่เป็นปัญหา)
        const SCHEDULE_BATCH = 50
        for (let i = 0; i < scheduleRows.length; i += SCHEDULE_BATCH) {
          const batch = scheduleRows.slice(i, i + SCHEDULE_BATCH)
          await Promise.all(
            batch.map(row =>
              prisma.pMSchedule.upsert({
                where: {
                  pmItemId_scheduledDate: {
                    pmItemId: row.pmItemId,
                    scheduledDate: row.scheduledDate,
                  },
                },
                create: { pmItemId: row.pmItemId, scheduledDate: row.scheduledDate, status: row.status },
                update: {}, // ไม่ทับ status / photoUrl ที่ check-in แล้ว
              })
            )
          )
          createdSchedules += batch.length
        }
      }
    }

    await prisma.importFile.update({
      where: { id: importFile.id },
      data: { status: 'SUCCESS' },
    })

    return NextResponse.json({
      success: true,
      importFileId: importFile.id,
      items: createdItems,
      schedules: createdSchedules,
      errors: parseResult.errors,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await prisma.importFile.update({
      where: { id: importFile.id },
      data: { status: 'FAILED', errorMsg: msg },
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
