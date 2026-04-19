import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMonthlySummaryNotify } from '@/lib/line-notify'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  // Default: previous month
  const now = new Date()
  let targetMonth = body.month ?? (now.getMonth() === 0 ? 12 : now.getMonth())
  let targetYear = body.year ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())

  const dateGte = new Date(Date.UTC(targetYear, targetMonth - 1, 1))
  const dateLt = new Date(Date.UTC(targetYear, targetMonth, 1))

  // Get all projects with Line config
  const projects = await prisma.project.findMany({
    where: { lineChannelToken: { not: null }, lineGroupId: { not: null } },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  if (projects.length === 0) {
    return NextResponse.json({ error: 'ไม่มีโครงการที่ตั้งค่า Line ไว้' }, { status: 400 })
  }

  // Check all projects have comments on abnormal sub-categories
  const missingComments: { project: string; missing: string[] }[] = []

  for (const project of projects) {
    const schedules = await prisma.pMSchedule.findMany({
      where: {
        pmItem: { projectId: project.id },
        OR: [
          { scheduledDate: { gte: dateGte, lt: dateLt }, NOT: { status: 'RESCHEDULED' } },
          { rescheduledDate: { gte: dateGte, lt: dateLt }, status: 'RESCHEDULED' },
        ],
        status: 'DONE',
        result: 'FAIL',
      },
      include: {
        pmItem: { select: { type: true, category: true, subCategory: true } },
      },
    })

    // Collect unique abnormal sub-categories
    const abnormalKeys = new Set<string>()
    for (const s of schedules) {
      const subCat = s.pmItem.subCategory || s.pmItem.category
      abnormalKeys.add(`${s.pmItem.type}__${s.pmItem.category}__${subCat}`)
    }

    if (abnormalKeys.size === 0) continue

    // Check which ones have comments
    const comments = await prisma.pMSubCategoryComment.findMany({
      where: { projectId: project.id, month: targetMonth, year: targetYear },
    })
    const commentedKeys = new Set(comments.map(c => `${c.type}__${c.category}__${c.subCategory}`))

    const missing: string[] = []
    for (const key of Array.from(abnormalKeys)) {
      if (!commentedKeys.has(key)) {
        const [, category, subCat] = key.split('__')
        missing.push(`${category} > ${subCat}`)
      }
    }

    if (missing.length > 0) {
      missingComments.push({ project: project.name, missing })
    }
  }

  if (missingComments.length > 0) {
    return NextResponse.json({
      error: 'Engineer ยังไม่ได้ comment Sub-Category ที่ผิดปกติครบ',
      missingComments,
    }, { status: 400 })
  }

  // Send monthly summary to all projects
  const results: { project: string; success: boolean }[] = []

  for (const project of projects) {
    const schedules = await prisma.pMSchedule.findMany({
      where: {
        pmItem: { projectId: project.id },
        OR: [
          { scheduledDate: { gte: dateGte, lt: dateLt }, NOT: { status: 'RESCHEDULED' } },
          { rescheduledDate: { gte: dateGte, lt: dateLt }, status: 'RESCHEDULED' },
        ],
      },
      include: {
        pmItem: { select: { type: true, category: true, subCategory: true, period: true } },
      },
    })

    const comments = await prisma.pMSubCategoryComment.findMany({
      where: { projectId: project.id, month: targetMonth, year: targetYear },
    })
    const commentMap: Record<string, string> = {}
    for (const c of comments) {
      commentMap[`${c.type}__${c.category}__${c.subCategory}`] = c.comment
    }

    // Group by type → category → subCategory
    const sectionMap: Record<string, {
      type: string; category: string
      subCategories: Record<string, {
        subCategory: string; totalCount: number; doneCount: number
        passCount: number; failCount: number; pendingCount: number; engineerComment: string
      }>
    }> = {}

    for (const s of schedules) {
      const catKey = `${s.pmItem.type}__${s.pmItem.category}`
      if (!sectionMap[catKey]) {
        sectionMap[catKey] = { type: s.pmItem.type, category: s.pmItem.category, subCategories: {} }
      }
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
        if (s.result === 'PASS') sub.passCount++
        else if (s.result === 'FAIL') sub.failCount++
      } else {
        sub.pendingCount++
      }
    }

    const sections = Object.values(sectionMap).map(sec => ({
      ...sec,
      subCategories: Object.values(sec.subCategories),
    }))

    // Calc totals
    let totalAll = 0, totalDone = 0, totalPass = 0, totalFail = 0, totalPending = 0
    for (const sec of sections) {
      for (const sub of sec.subCategories) {
        totalAll += sub.totalCount; totalDone += sub.doneCount
        totalPass += sub.passCount; totalFail += sub.failCount; totalPending += sub.pendingCount
      }
    }

    const success = await sendMonthlySummaryNotify(
      project.lineChannelToken!,
      project.lineGroupId!,
      { projectName: project.name, month: targetMonth, year: targetYear, sections }
    )

    results.push({ project: project.name, success })
  }

  const successCount = results.filter(r => r.success).length
  return NextResponse.json({ results, successCount, total: results.length, month: targetMonth, year: targetYear })
}
