import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const todayISO = new Date().toISOString().slice(0, 10)

  // Support both single `date` and range `from`/`to`
  const fromParam = searchParams.get('from') || searchParams.get('date') || todayISO
  const toParam   = searchParams.get('to')   || searchParams.get('date') || todayISO

  const { year: fy, month: fm, day: fd } = parseDate(fromParam)
  const { year: ty, month: tm, day: td } = parseDate(toParam)

  const rangeStart = new Date(Date.UTC(fy, fm, fd, 0, 0, 0))
  const rangeEnd   = new Date(Date.UTC(ty, tm, td + 1, 0, 0, 0)) // exclusive

  const schedules = await prisma.pMSchedule.findMany({
    where: {
      checkedAt: { gte: rangeStart, lt: rangeEnd },
      status: 'DONE',
    },
    include: {
      pmItem: {
        select: {
          projectId: true,
          project: { select: { name: true, code: true, color: true } },
        },
      },
      checkedBy: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
    orderBy: { checkedAt: 'asc' },
  })

  // ── Aggregate per project ──────────────────────────────────────────────────
  const projectMap = new Map<string, {
    projectId: string; projectName: string; projectCode: string; projectColor: string
    checkCount: number; users: Map<string, { id: string; name: string; username: string; role: string }>
  }>()

  for (const s of schedules) {
    const pid = s.pmItem.projectId
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        projectId: pid,
        projectName: s.pmItem.project.name,
        projectCode: s.pmItem.project.code,
        projectColor: s.pmItem.project.color,
        checkCount: 0,
        users: new Map(),
      })
    }
    const proj = projectMap.get(pid)!
    proj.checkCount++
    if (s.checkedBy) proj.users.set(s.checkedBy.id, s.checkedBy)
  }

  const projects = Array.from(projectMap.values()).map((p) => ({
    projectId: p.projectId,
    projectName: p.projectName,
    projectCode: p.projectCode,
    projectColor: p.projectColor,
    checkCount: p.checkCount,
    users: Array.from(p.users.values()),
  }))

  // ── Daily breakdown ────────────────────────────────────────────────────────
  const dailyMap = new Map<string, {
    checkCount: number
    projectIds: Set<string>
    userIds: Set<string>
  }>()

  for (const s of schedules) {
    if (!s.checkedAt) continue
    const dateKey = s.checkedAt.toISOString().slice(0, 10)
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { checkCount: 0, projectIds: new Set(), userIds: new Set() })
    }
    const day = dailyMap.get(dateKey)!
    day.checkCount++
    day.projectIds.add(s.pmItem.projectId)
    if (s.checkedById) day.userIds.add(s.checkedById)
  }

  // Fill every day in range (including zeros)
  const daily: { date: string; checkCount: number; projectCount: number; userCount: number }[] = []
  const cur = new Date(rangeStart)
  while (cur < rangeEnd) {
    const key = cur.toISOString().slice(0, 10)
    const d = dailyMap.get(key)
    daily.push({
      date: key,
      checkCount:   d?.checkCount ?? 0,
      projectCount: d?.projectIds.size ?? 0,
      userCount:    d?.userIds.size ?? 0,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const allUserIds = new Set(schedules.map((s) => s.checkedById).filter(Boolean))

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    totalProjects: projectMap.size,
    totalUsers: allUserIds.size,
    totalChecks: schedules.length,
    projects,
    daily,
  })
}
