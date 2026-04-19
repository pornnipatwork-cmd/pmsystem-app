import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import ExcelJS from 'exceljs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { role: { not: 'SUPER_ADMIN' } },
    select: {
      username: true, name: true, employeeId: true, role: true,
      projects: { include: { project: { select: { code: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Users')

  sheet.columns = [
    { header: 'username', key: 'username', width: 20 },
    { header: 'name', key: 'name', width: 25 },
    { header: 'employeeId', key: 'employeeId', width: 15 },
    { header: 'role', key: 'role', width: 15 },
    { header: 'password', key: 'password', width: 20 },
    { header: 'projectCodes', key: 'projectCodes', width: 30 },
  ]

  // Style header row
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } }

  for (const u of users) {
    const projectCodes = u.projects.map((up) => up.project.code).join(',')
    sheet.addRow({
      username: u.username,
      name: u.name,
      employeeId: u.employeeId ?? '',
      role: u.role,
      password: '', // leave blank — fill in only if you want to reset
      projectCodes,
    })
  }

  // Add note on password column
  sheet.getCell('E1').note = 'กรอก password เฉพาะเมื่อต้องการเปลี่ยน หรือสำหรับ user ใหม่'

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="users_export.xlsx"',
    },
  })
}
