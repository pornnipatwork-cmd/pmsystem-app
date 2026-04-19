import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'
import { getTodayBangkok } from '@/lib/status'

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

  const today = getTodayBangkok()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [todayCount, overdueCount] = await Promise.all([
    prisma.pMSchedule.count({
      where: {
        pmItem: { projectId },
        scheduledDate: { gte: today, lt: tomorrow },
        result: null,
        rescheduledDate: null,
      },
    }),
    prisma.pMSchedule.count({
      where: {
        pmItem: { projectId },
        scheduledDate: { lt: today },
        result: null,
        rescheduledDate: null,
      },
    }),
  ])

  return NextResponse.json({
    scheduleBadge: todayCount + overdueCount,
    overdueBadge: overdueCount,
    todayCount,
    overdueCount,
  })
}
