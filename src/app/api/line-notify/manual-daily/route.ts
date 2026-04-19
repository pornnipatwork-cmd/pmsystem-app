import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendDailySummaryNotify } from '@/lib/line-notify'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date()
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  // Get all projects with Line config
  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  if (projects.length === 0) {
    return NextResponse.json({ error: 'ไม่มีโครงการที่ตั้งค่า Line ไว้' }, { status: 400 })
  }

  const results: { project: string; success: boolean }[] = []

  for (const project of projects) {
    // Get today's schedules
    const todaySchedules = await prisma.pMSchedule.findMany({
      where: {
        status: { in: ['TODAY', 'UPCOMING'] },
        scheduledDate: { gte: todayStart, lt: todayEnd },
        pmItem: { projectId: project.id },
      },
      include: { pmItem: { select: { name: true, type: true } } },
    })

    // Get overdue count
    const overdueCount = await prisma.pMSchedule.count({
      where: { status: 'OVERDUE', pmItem: { projectId: project.id } },
    })

    const success = await sendDailySummaryNotify(
      project.lineChannelToken!,
      project.lineGroupId!,
      {
        projectName: project.name,
        todayItems: todaySchedules.map((s) => ({
          machineName: s.pmItem.name,
          type: s.pmItem.type,
        })),
        overdueCount,
        date: today,
      }
    )

    results.push({ project: project.name, success })
  }

  const successCount = results.filter((r) => r.success).length
  return NextResponse.json({ results, successCount, total: results.length })
}
