import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import ExcelJS from 'exceljs'

const VALID_TYPES = ['HIGHRISE', 'LOWRISE_AP', 'LOWRISE_NONAP']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)' }, { status: 400 })
  }

  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as any)

  const sheet = workbook.worksheets[0]
  if (!sheet) return NextResponse.json({ error: 'ไม่พบ Sheet ในไฟล์' }, { status: 400 })

  // Read header row to map columns by name
  const headerRow = sheet.getRow(1)
  const headers: Record<string, number> = {}
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? '').trim().toLowerCase()
    headers[val] = colNumber
  })

  const col = (row: ExcelJS.Row, name: string) => {
    const idx = headers[name]
    if (!idx) return ''
    const v = row.getCell(idx).value
    return v != null ? String(v).trim() : ''
  }

  let added = 0, updated = 0, skipped = 0
  const errors: string[] = []

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const code = col(row, 'code')
    const name = col(row, 'name')
    const type = col(row, 'type').toUpperCase()

    if (!code && !name) continue // skip empty rows
    if (!code || !name) { errors.push(`แถว ${i}: code และ name จำเป็น`); skipped++; continue }
    if (type && !VALID_TYPES.includes(type)) {
      errors.push(`แถว ${i}: type "${type}" ไม่ถูกต้อง (HIGHRISE, LOWRISE_AP, LOWRISE_NONAP)`)
      skipped++; continue
    }

    const data = {
      name,
      type: type || 'HIGHRISE',
      location: col(row, 'location') || null,
      description: col(row, 'description') || null,
      color: col(row, 'color') || '#1D9E75',
    }

    const existing = await prisma.project.findUnique({ where: { code } })
    if (existing) {
      await prisma.project.update({ where: { code }, data })
      updated++
    } else {
      await prisma.project.create({ data: { code, ...data } })
      added++
    }
  }

  return NextResponse.json({ added, updated, skipped, errors })
}
