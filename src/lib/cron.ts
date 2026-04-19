import { prisma } from './prisma'
import { calculateStatus, getCurrentTimeBangkok, getTodayBangkok } from './status'
import { sendDailySummaryNotify, sendMonthlySummaryNotify, sendOverdueNotify } from './line-notify'

/** รันงาน Line notify ทั้งหมด — เรียกจาก /api/cron/daily-tasks */
export async function runDailyLineTasks() {
  await Promise.allSettled([
    runDailySummary(),
    checkMonthlyReport(),
    checkOverdueNotify(),
  ])
}

/** อัปเดต schedule ที่ค้างเป็น OVERDUE — เรียก manual จาก /api/admin/trigger-overdue */
export async function updateOverdueStatuses(): Promise<number> {
  const today = getTodayBangkok()

  const staleSchedules = await prisma.pMSchedule.findMany({
    where: {
      scheduledDate: { lt: today },
      result: null,
      rescheduledDate: null,
      status: { in: ['UPCOMING', 'TODAY'] },
    },
    select: { id: true, scheduledDate: true, result: true, rescheduledDate: true },
  })

  if (staleSchedules.length === 0) return 0

  const ids = staleSchedules
    .filter((s) => calculateStatus(s) === 'OVERDUE')
    .map((s) => s.id)

  if (ids.length > 0) {
    await prisma.pMSchedule.updateMany({
      where: { id: { in: ids } },
      data: { status: 'OVERDUE' },
    })
  }
  return ids.length
}

async function runDailySummary() {
  const settings = await prisma.systemSetting.findMany()
  const settingMap: Record<string, string> = {}
  for (const s of settings) settingMap[s.key] = s.value
  if (settingMap.lineNotifyEnabled !== 'true') return

  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  for (const project of projects) {
    if (!project.lineChannelToken || !project.lineGroupId) continue

    const today = getTodayBangkok()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todaySchedules = await prisma.pMSchedule.findMany({
      where: {
        pmItem: { projectId: project.id },
        scheduledDate: { gte: today, lt: tomorrow },
        status: { in: ['TODAY', 'UPCOMING'] },
        result: null,
      },
      include: { pmItem: { select: { name: true, type: true } } },
    })

    const overdueCount = await prisma.pMSchedule.count({
      where: { pmItem: { projectId: project.id }, status: 'OVERDUE' },
    })

    await sendDailySummaryNotify(project.lineChannelToken, project.lineGroupId, {
      projectName: project.name,
      todayItems: todaySchedules.map((s) => ({ machineName: s.pmItem.name, type: s.pmItem.type })),
      overdueCount,
      date: today,
    })
  }
}

async function checkMonthlyReport() {
  const settings = await prisma.systemSetting.findMany()
  const settingMap: Record<string, string> = {}
  for (const s of settings) settingMap[s.key] = s.value
  if (settingMap.lineMonthlyEnabled !== 'true') return

  const configuredDay = parseInt(settingMap.lineMonthlyDay || '5')
  const today = getTodayBangkok()
  if (today.getUTCDate() !== configuredDay) return

  const prevMonth = today.getUTCMonth() === 0 ? 12 : today.getUTCMonth()
  const prevYear = today.getUTCMonth() === 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear()
  const dateGte = new Date(Date.UTC(prevYear, prevMonth - 1, 1))
  const dateLt = new Date(Date.UTC(prevYear, prevMonth, 1))

  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  for (const project of projects) {
    const schedules = await prisma.pMSchedule.findMany({
      where: {
        pmItem: { projectId: project.id },
        OR: [
          { scheduledDate: { gte: dateGte, lt: dateLt }, NOT: { status: 'RESCHEDULED' } },
          { rescheduledDate: { gte: dateGte, lt: dateLt }, status: 'RESCHEDULED' },
        ],
      },
      include: { pmItem: { select: { type: true, category: true, subCategory: true } } },
    })

    const comments = await prisma.pMSubCategoryComment.findMany({
      where: { projectId: project.id, month: prevMonth, year: prevYear },
    })
    const commentMap: Record<string, string> = {}
    for (const c of comments) commentMap[`${c.type}__${c.category}__${c.subCategory}`] = c.comment

    const abnormalKeys = new Set<string>()
    for (const s of schedules) {
      if (s.status === 'DONE' && (s as any).result === 'FAIL') {
        const subCat = s.pmItem.subCategory || s.pmItem.category
        abnormalKeys.add(`${s.pmItem.type}__${s.pmItem.category}__${subCat}`)
      }
    }
    const allCommented = Array.from(abnormalKeys).every(k => commentMap[k])
    if (!allCommented) continue

    const sectionMap: Record<string, any> = {}
    for (const s of schedules) {
      const catKey = `${s.pmItem.type}__${s.pmItem.category}`
      if (!sectionMap[catKey]) sectionMap[catKey] = { type: s.pmItem.type, category: s.pmItem.category, subCategories: {} }
      const subCat = s.pmItem.subCategory || s.pmItem.category
      if (!sectionMap[catKey].subCategories[subCat]) {
        sectionMap[catKey].subCategories[subCat] = {
          subCategory: subCat, totalCount: 0, doneCount: 0,
          passCount: 0, failCount: 0, pendingCount: 0,
          engineerComment: commentMap[`${s.pmItem.type}__${s.pmItem.category}__${subCat}`] || '',
        }
      }
      const sub = sectionMap[catKey].subCategories[subCat]
      sub.totalCount++
      if (s.status === 'DONE') {
        sub.doneCount++
        if ((s as any).result === 'PASS') sub.passCount++
        else if ((s as any).result === 'FAIL') sub.failCount++
      } else sub.pendingCount++
    }

    const sections = Object.values(sectionMap).map((sec: any) => ({
      ...sec, subCategories: Object.values(sec.subCategories),
    }))

    await sendMonthlySummaryNotify(project.lineChannelToken!, project.lineGroupId!, {
      projectName: project.name, month: prevMonth, year: prevYear, sections,
    })
  }
}

async function checkOverdueNotify() {
  const settings = await prisma.systemSetting.findMany()
  const settingMap: Record<string, string> = {}
  for (const s of settings) settingMap[s.key] = s.value
  if (settingMap.lineOverdueEnabled !== 'true') return

  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  const today = getTodayBangkok()

  for (const project of projects) {
    if (!project.lineChannelToken || !project.lineGroupId) continue

    const overdueSchedules = await prisma.pMSchedule.findMany({
      where: { status: 'OVERDUE', pmItem: { projectId: project.id } },
      include: { pmItem: { select: { name: true, type: true } } },
      orderBy: { scheduledDate: 'asc' },
    })

    await sendOverdueNotify(project.lineChannelToken, project.lineGroupId, {
      projectName: project.name,
      overdueItems: overdueSchedules.map((s) => ({ machineName: s.pmItem.name, type: s.pmItem.type })),
      date: today,
    })
  }
}
