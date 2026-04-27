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

// ── Turso pipeline helper ──────────────────────────────────────────────────────
async function tursoPipeline(
  tursoUrl: string,
  tursoToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stmts: { sql: string; args: any[] }[]
): Promise<void> {
  const requests = [
    ...stmts.map(s => ({ type: 'execute', stmt: { sql: s.sql, args: s.args } })),
    { type: 'close' },
  ]
  const res = await fetch(`${tursoUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso pipeline error (${res.status}): ${text}`)
  }
}

// Turso HTTP API ต้องการ value เป็น string เสมอ (แม้ type จะเป็น integer)
// ref: https://docs.turso.tech/sdk/http/reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tv(value: string | number | null | undefined): any {
  if (value === null || value === undefined || value === '') return { type: 'null' }
  // ต้องส่ง value เป็น string เสมอ — SQLite จะ coerce type ให้อัตโนมัติตาม column affinity
  return { type: 'text', value: String(value) }
}

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

    // ── อัปเดต SUCCESS ก่อนเริ่ม pipeline ──────────────────────────────────────
    // เหตุผล: ถ้า Vercel timeout ระหว่าง pipeline (ไฟล์ใหญ่), status จะเป็น SUCCESS แล้ว
    // ข้อมูลที่ commit ไปแล้วจะยังอยู่ใน DB ถูกต้อง
    // (ถ้า pipeline error จริงๆ, catch block จะเปลี่ยนกลับเป็น FAILED)
    await prisma.importFile.update({
      where: { id: importFile.id },
      data: { status: 'SUCCESS' },
    })

    let createdItems = 0
    let createdSchedules = 0

    const isTurso = !!process.env.TURSO_DATABASE_URL

    if (isTurso) {
      // ══════════════════════════════════════════════════════════════════════
      // PRODUCTION PATH — Turso Pipeline API
      // ทุก DB operation รวมเป็น 2-4 HTTP calls (ไม่ว่าจะมีกี่ item/schedule)
      // ══════════════════════════════════════════════════════════════════════
      const tursoUrl = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://')
      const tursoToken = process.env.TURSO_AUTH_TOKEN!

      // ── Step 1: ดึงเฉพาะ PMItem ที่ number ตรงกับไฟล์ (ลด response size 10-100x) ──
      // ใช้ number IN (...) แทนการดึง ALL items ของ project
      const parsedNumbers = [...new Set(parseResult.items.map(i => i.number))]
      const existingItems = await prisma.pMItem.findMany({
        where: { projectId, number: { in: parsedNumbers } },
        select: { id: true, type: true, number: true },
      })
      const existingMap = new Map(existingItems.map(i => [`${i.type}:${i.number}`, i.id]))

      // ── Step 2: กำหนด ID ให้ทุก item (ใช้ existing ID หรือ UUID ใหม่) ──
      const classifiedItems = parseResult.items.map(item => ({
        ...item,
        pmItemId: existingMap.get(`${item.type}:${item.number}`) ?? crypto.randomUUID(),
        isNew: !existingMap.has(`${item.type}:${item.number}`),
      }))
      createdItems = classifiedItems.length

      // ── Step 3: Turso pipeline สำหรับ PMItem INSERT/UPDATE ──
      // 300 statements ต่อ HTTP call → 150 items = 1 HTTP call เท่านั้น
      const ITEM_CHUNK = 300
      for (let i = 0; i < classifiedItems.length; i += ITEM_CHUNK) {
        const chunk = classifiedItems.slice(i, i + ITEM_CHUNK)
        const stmts: { sql: string; args: unknown[] }[] = []

        for (const ci of chunk) {
          if (ci.isNew) {
            stmts.push({
              sql: 'INSERT INTO PMItem (id, projectId, importedFileId, type, category, subCategory, no, name, number, location, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              args: [
                tv(ci.pmItemId), tv(projectId), tv(importFile.id),
                tv(ci.type), tv(ci.category), tv(ci.subCategory),
                tv(ci.no), tv(ci.name), tv(ci.number),
                tv(ci.location), tv(ci.period),
              ],
            })
          } else {
            stmts.push({
              sql: 'UPDATE PMItem SET category=?, subCategory=?, name=?, location=?, period=? WHERE id=?',
              args: [
                tv(ci.category), tv(ci.subCategory), tv(ci.name),
                tv(ci.location), tv(ci.period), tv(ci.pmItemId),
              ],
            })
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tursoPipeline(tursoUrl, tursoToken, stmts as any)
      }

      // ── Step 4: สร้าง schedule rows ──
      const scheduleRows: { pmItemId: string; scheduledDate: Date; status: string }[] = []
      for (const ci of classifiedItems) {
        for (const day of ci.scheduleDays) {
          const scheduledDate = new Date(Date.UTC(year, month - 1, day))
          const status = calculateStatus({ scheduledDate })
          scheduleRows.push({ pmItemId: ci.pmItemId, scheduledDate, status })
        }
      }

      // ── Step 5: Turso pipeline สำหรับ PMSchedule INSERT OR IGNORE ──
      // 500 statements ต่อ HTTP call → 3000 schedules = 6 HTTP calls
      const SCHED_CHUNK = 500
      for (let i = 0; i < scheduleRows.length; i += SCHED_CHUNK) {
        const chunk = scheduleRows.slice(i, i + SCHED_CHUNK)
        const stmts = chunk.map(row => ({
          sql: 'INSERT OR IGNORE INTO PMSchedule (id, pmItemId, scheduledDate, status) VALUES (?, ?, ?, ?)',
          args: [
            tv(crypto.randomUUID()),
            tv(row.pmItemId),
            tv(row.scheduledDate.toISOString()),
            tv(row.status),
          ],
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tursoPipeline(tursoUrl, tursoToken, stmts as any)
        createdSchedules += chunk.length
      }

    } else {
      // ══════════════════════════════════════════════════════════════════════
      // LOCAL DEV PATH — Prisma Upserts
      // SQLite local file ไม่มี network latency ดังนั้น sequential/parallel ไม่ต่างกัน
      // ══════════════════════════════════════════════════════════════════════
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

      const SCHEDULE_BATCH = 50
      for (let i = 0; i < scheduleRows.length; i += SCHEDULE_BATCH) {
        const batch = scheduleRows.slice(i, i + SCHEDULE_BATCH)
        await Promise.all(
          batch.map(row =>
            prisma.pMSchedule.upsert({
              where: {
                pmItemId_scheduledDate: { pmItemId: row.pmItemId, scheduledDate: row.scheduledDate },
              },
              create: { pmItemId: row.pmItemId, scheduledDate: row.scheduledDate, status: row.status },
              update: {},
            })
          )
        )
        createdSchedules += batch.length
      }
    }

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
