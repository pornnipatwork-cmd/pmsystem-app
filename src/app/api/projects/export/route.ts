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

  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Projects')

  sheet.columns = [
    { header: 'code', key: 'code', width: 15 },
    { header: 'name', key: 'name', width: 30 },
    { header: 'type', key: 'type', width: 18 },
    { header: 'location', key: 'location', width: 25 },
    { header: 'description', key: 'description', width: 35 },
    { header: 'color', key: 'color', width: 12 },
  ]

  // Style header row
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } }

  for (const p of projects) {
    sheet.addRow({
      code: p.code,
      name: p.name,
      type: p.type,
      location: p.location ?? '',
      description: p.description ?? '',
      color: p.color,
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="projects_export.xlsx"',
    },
  })
}
