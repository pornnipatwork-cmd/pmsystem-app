import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendOverdueNotify } from '@/lib/line-notify'
import { getTodayBangkok } from '@/lib/status'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all projects with Line config
  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  if (projects.length === 0) {
    return NextResponse.json({ error: 'ไม่มีโครงการที่ตั้งค่า Line ไว้' }, { status: 400 })
  }

  const today = getTodayBangkok()
  const results: { project: string; success: boolean; overdueCount: number }[] = []

  for (const project of projects) {
    // Get all OVERDUE schedules for this project
    const overdueSchedules = await prisma.pMSchedule.findMany({
      where: {
        status: 'OVERDUE',
        pmItem: { projectId: project.id },
      },
      include: { pmItem: { select: { name: true, type: true } } },
      orderBy: { scheduledDate: 'asc' },
    })

    const success = await sendOverdueNotify(
      project.lineChannelToken!,
      project.lineGroupId!,
      {
        projectName: project.name,
        overdueItems: overdueSchedules.map((s) => ({
          machineName: s.pmItem.name,
          type: s.pmItem.type,
        })),
        date: today,
      }
    )

    results.push({ project: project.name, success, overdueCount: overdueSchedules.length })
  }

  const successCount = results.filter((r) => r.success).length
  return NextResponse.json({ results, successCount, total: results.length })
}
