import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Count schedules linked to imported items before deletion
  const scheduleCount = await prisma.pMSchedule.count({
    where: {
      pmItem: { importedFileId: { not: null } },
    },
  })

  // Delete all PMItems with importedFileId not null (cascades PMSchedules)
  const deleted = await prisma.pMItem.deleteMany({
    where: { importedFileId: { not: null } },
  })

  // Delete all ImportFile records
  await prisma.importFile.deleteMany({})

  return NextResponse.json({
    deletedItems: deleted.count,
    deletedSchedules: scheduleCount,
  })
}
