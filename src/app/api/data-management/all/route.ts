import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Count all schedules before deletion
  const scheduleCount = await prisma.pMSchedule.count()

  // Delete all PMItems (cascades PMSchedules via onDelete: Cascade)
  const deleted = await prisma.pMItem.deleteMany({})

  // Delete all ImportFile records
  await prisma.importFile.deleteMany({})

  return NextResponse.json({
    deletedItems: deleted.count,
    deletedSchedules: scheduleCount,
  })
}
