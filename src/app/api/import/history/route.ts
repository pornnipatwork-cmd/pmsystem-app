import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const history = await prisma.importFile.findMany({
    where: { projectId },
    include: {
      importedBy: { select: { id: true, name: true } },
    },
    orderBy: { importedAt: 'desc' },
    take: 50,
  })

  // นับ PMSchedule จริงๆ ตามเดือน/ปี ของแต่ละ import file
  const result = await Promise.all(
    history.map(async (h) => {
      const startDate = new Date(h.year, h.month - 1, 1)
      const endDate = new Date(h.year, h.month, 1)

      const scheduleCount = await prisma.pMSchedule.count({
        where: {
          pmItem: { projectId },
          scheduledDate: { gte: startDate, lt: endDate },
        },
      })

      const itemCount = await prisma.pMItem.count({
        where: { projectId },
      })

      return {
        ...h,
        scheduleCount,
        itemCount,
      }
    })
  )

  return NextResponse.json(result)
}
