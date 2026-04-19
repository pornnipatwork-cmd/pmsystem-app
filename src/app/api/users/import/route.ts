import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import ExcelJS from 'exceljs'
import bcrypt from 'bcryptjs'

const VALID_ROLES = ['ADMIN', 'TECHNICIAN', 'ENGINEER', 'ASSIST_ADMIN', 'BMVM']

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

  // Map headers
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

  // Pre-load all projects for code→id lookup
  const allProjects = await prisma.project.findMany({ select: { id: true, code: true } })
  const projectMap = Object.fromEntries(allProjects.map((p) => [p.code, p.id]))

  let added = 0, updated = 0, skipped = 0
  const errors: string[] = []

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const username = col(row, 'username')
    const name = col(row, 'name')
    const role = col(row, 'role').toUpperCase()

    if (!username && !name) continue
    if (!username || !name) { errors.push(`แถว ${i}: username และ name จำเป็น`); skipped++; continue }
    if (role && !VALID_ROLES.includes(role)) {
      errors.push(`แถว ${i}: role "${role}" ไม่ถูกต้อง`)
      skipped++; continue
    }

    const employeeId = col(row, 'employeeid') || col(row, 'employee_id') || null
    const password = col(row, 'password')
    const projectCodesRaw = col(row, 'projectcodes') || col(row, 'project_codes') || col(row, 'projects')
    const projectIds = projectCodesRaw
      ? projectCodesRaw.split(',').map((c) => c.trim()).filter(Boolean).map((c) => projectMap[c]).filter(Boolean)
      : []

    const existing = await prisma.user.findUnique({ where: { username } })

    if (existing) {
      // Update: name, employeeId, role — password only if provided
      const updateData: Record<string, unknown> = {
        name,
        employeeId: employeeId || null,
        role: role || existing.role,
      }
      if (password) updateData.password = await bcrypt.hash(password, 10)

      await prisma.userProject.deleteMany({ where: { userId: existing.id } })
      await prisma.user.update({
        where: { username },
        data: {
          ...updateData,
          ...(projectIds.length > 0 ? {
            projects: { create: projectIds.map((pid: string) => ({ projectId: pid })) },
          } : {}),
        },
      })
      updated++
    } else {
      // Create: password required
      if (!password) {
        errors.push(`แถว ${i}: "${username}" เป็น user ใหม่ต้องระบุ password`)
        skipped++; continue
      }
      const hashed = await bcrypt.hash(password, 10)
      await prisma.user.create({
        data: {
          username, name, employeeId: employeeId || null,
          role: role || 'TECHNICIAN',
          password: hashed,
          projects: { create: projectIds.map((pid: string) => ({ projectId: pid })) },
        },
      })
      added++
    }
  }

  return NextResponse.json({ added, updated, skipped, errors })
}
