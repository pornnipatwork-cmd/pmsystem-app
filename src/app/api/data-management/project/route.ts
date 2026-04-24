import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { projectId } = body

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  // Count PMItems to be deleted for this project
  const itemCount = await prisma.pMItem.count({
    where: { projectId },
  })

  // Count schedules linked to those items
  const scheduleCount = await prisma.pMSchedule.count({
    where: { pmItem: { projectId } },
  })

  // Delete PMItems (cascades PMSchedules via onDelete: Cascade)
  const deleted = await prisma.pMItem.deleteMany({
    where: { projectId },
  })

  // Delete ImportFile records for this project
  await prisma.importFile.deleteMany({
    where: { projectId },
  })

  return NextResponse.json({
    deletedItems: deleted.count,
    deletedSchedules: scheduleCount,
  })
}
