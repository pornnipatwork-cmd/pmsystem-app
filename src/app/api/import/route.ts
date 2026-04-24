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

    // Upsert PM Items (ทีละรายการ — ต้องการ id กลับมาสำหรับ schedule)
    let createdItems = 0
    const scheduleRows: { pmItemId: string; scheduledDate: Date; status: string }[] = []

    for (const item of parseResult.items) {
      const pmItem = await prisma.pMItem.upsert({
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
      createdItems++

      // รวบรวม schedule data สำหรับ batch insert
      for (const day of item.scheduleDays) {
        const scheduledDate = new Date(Date.UTC(year, month - 1, day))
        const status = calculateStatus({ scheduledDate })
        scheduleRows.push({ pmItemId: pmItem.id, scheduledDate, status })
      }
    }

    // Batch insert schedules ด้วย INSERT OR IGNORE (ไม่ทับข้อมูลที่ check-in แล้ว)
    let createdSchedules = 0
    if (scheduleRows.length > 0) {
      // แบ่งเป็น chunk เพื่อไม่ให้ query ยาวเกินไป
      const CHUNK = 50
      for (let i = 0; i < scheduleRows.length; i += CHUNK) {
        const chunk = scheduleRows.slice(i, i + CHUNK)
        const placeholders = chunk.map(() => '(?, ?, ?)').join(', ')
        const values = chunk.flatMap(r => [r.pmItemId, r.scheduledDate.toISOString(), r.status])
        await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO PMSchedule (id, pmItemId, scheduledDate, status) SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))), t.a, t.b, t.c FROM (VALUES ${placeholders}) AS t(a,b,c)`,
          ...values
        )
        createdSchedules += chunk.length
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
