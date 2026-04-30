import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'

// GET: list import files for a project
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const files = await prisma.importFile.findMany({
    where: { projectId },
    include: {
      importedBy: { select: { name: true } },
      _count: { select: { pmItems: true } },
    },
    orderBy: { importedAt: 'desc' },
  })

  // Count schedules for each file's month/year (more meaningful than PMItem count)
  const result = await Promise.all(
    files.map(async (f) => {
      const dateGte = new Date(Date.UTC(f.year, f.month - 1, 1))
      const dateLt = new Date(Date.UTC(f.year, f.month, 1))

      const scheduleCount = await prisma.pMSchedule.count({
        where: {
          pmItem: { projectId },
          OR: [
            { scheduledDate: { gte: dateGte, lt: dateLt }, NOT: { status: 'RESCHEDULED' } },
            { rescheduledDate: { gte: dateGte, lt: dateLt }, status: 'RESCHEDULED' },
          ],
        },
      })

      return {
        id: f.id,
        fileName: f.fileName,
        month: f.month,
        year: f.year,
        importedAt: f.importedAt,
        importedBy: f.importedBy.name,
        itemCount: f._count.pmItems,      // PMItems owned by this file
        scheduleCount,                     // Schedules for this month/year
        status: f.status,
      }
    })
  )

  return NextResponse.json(result)
}

// DELETE: delete a specific import file and its PMItems (cascade to schedules)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { importFileId } = body
  if (!importFileId) return NextResponse.json({ error: 'importFileId required' }, { status: 400 })

  // Count schedules before deletion
  const scheduleCount = await prisma.pMSchedule.count({
    where: { pmItem: { importedFileId: importFileId } },
  })

  // Delete PMItems linked to this file (cascades to PMSchedules)
  const deleted = await prisma.pMItem.deleteMany({
    where: { importedFileId: importFileId },
  })

  // Delete the ImportFile record itself
  await prisma.importFile.delete({ where: { id: importFileId } })

  return NextResponse.json({
    deletedItems: deleted.count,
    deletedSchedules: scheduleCount,
  })
}
