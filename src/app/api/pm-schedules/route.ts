import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'
import { calculateStatus } from '@/lib/status'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const type = searchParams.get('type')
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const status = searchParams.get('status')
  const date = searchParams.get('date') // specific date YYYY-MM-DD

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let dateFilter: Record<string, Date> = {}

  if (date) {
    const d = new Date(date)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    dateFilter = { gte: d, lt: next }
  } else if (month && year) {
    dateFilter = {
      gte: new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1)),
      lt: new Date(Date.UTC(parseInt(year), parseInt(month), 1)),
    }
  }

  const hasDateFilter = Object.keys(dateFilter).length > 0

  const schedules = await prisma.pMSchedule.findMany({
    where: {
      pmItem: {
        projectId,
        ...(type ? { type: type as 'EE' | 'ME' } : {}),
      },
      ...(hasDateFilter ? {
        OR: [
          // รายการปกติ (ไม่ได้นัดใหม่) — กรองตาม scheduledDate
          { scheduledDate: dateFilter, NOT: { status: 'RESCHEDULED' } },
          // รายการที่นัดใหม่ — กรองตาม rescheduledDate
          { rescheduledDate: dateFilter, status: 'RESCHEDULED' },
        ],
      } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      pmItem: {
        select: {
          id: true, name: true, number: true, location: true,
          type: true, category: true, subCategory: true, period: true, no: true,
        },
      },
      checkedBy: { select: { id: true, name: true } },
      rescheduledBy: { select: { id: true, name: true } },
    },
    orderBy: { scheduledDate: 'asc' },
  })

  // Recalculate status dynamically
  const result = schedules.map((s) => ({
    ...s,
    status: calculateStatus({
      scheduledDate: s.scheduledDate,
      result: s.result,
      rescheduledDate: s.rescheduledDate,
    }),
    scheduledDate: s.scheduledDate.toISOString(),
    checkedAt: s.checkedAt?.toISOString() ?? null,
    rescheduledDate: s.rescheduledDate?.toISOString() ?? null,
  }))

  return NextResponse.json(result)
}
