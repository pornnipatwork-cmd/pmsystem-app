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
  const month = parseInt(searchParams.get('month') || '0')
  const year = parseInt(searchParams.get('year') || '0')
  const typeFilter = searchParams.get('type') || 'ALL' // EE, ME, ALL

  if (!projectId || !month || !year) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const projectIds = session.user.projects.map((p: { id: string }) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dateGte = new Date(Date.UTC(year, month - 1, 1))
  const dateLt = new Date(Date.UTC(year, month, 1))

  const schedules = await prisma.pMSchedule.findMany({
    where: {
      pmItem: {
        projectId,
        ...(typeFilter !== 'ALL' ? { type: typeFilter as 'EE' | 'ME' } : {}),
      },
      OR: [
        { scheduledDate: { gte: dateGte, lt: dateLt }, NOT: { status: 'RESCHEDULED' } },
        { rescheduledDate: { gte: dateGte, lt: dateLt }, status: 'RESCHEDULED' },
      ],
    },
    include: {
      pmItem: {
        select: { id: true, name: true, number: true, type: true, category: true, subCategory: true, period: true, no: true },
      },
    },
    orderBy: { scheduledDate: 'asc' },
  })

  // Fetch engineer comments for this month/year
  const comments = await prisma.pMSubCategoryComment.findMany({
    where: { projectId, month, year },
  })
  const commentMap: Record<string, string> = {}
  for (const c of comments) {
    commentMap[`${c.type}__${c.category}__${c.subCategory}`] = c.comment
  }

  // Fetch project name
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })

  // Group by type → category → subCategory
  const sections: Record<string, {
    type: string
    category: string
    subCategories: Record<string, {
      subCategory: string
      period: string
      totalCount: number
      doneCount: number
      passCount: number
      failCount: number
      pendingCount: number
      remarks: string[]
      engineerComment: string
    }>
  }> = {}

  for (const s of schedules) {
    const catKey = `${s.pmItem.type}__${s.pmItem.category}`
    if (!sections[catKey]) {
      sections[catKey] = { type: s.pmItem.type, category: s.pmItem.category, subCategories: {} }
    }
    const subKey = s.pmItem.subCategory || s.pmItem.category
    if (!sections[catKey].subCategories[subKey]) {
      sections[catKey].subCategories[subKey] = {
        subCategory: subKey,
        period: s.pmItem.period || 'M',
        totalCount: 0,
        doneCount: 0,
        passCount: 0,
        failCount: 0,
        pendingCount: 0,
        remarks: [],
        engineerComment: commentMap[`${s.pmItem.type}__${s.pmItem.category}__${subKey}`] || '',
      }
    }
    const sub = sections[catKey].subCategories[subKey]
    sub.totalCount++
    if (s.status === 'DONE') {
      sub.doneCount++
      if (s.result === 'PASS') sub.passCount++
      else if (s.result === 'FAIL') {
        sub.failCount++
        if (s.remark) sub.remarks.push(s.remark)
      }
    } else {
      sub.pendingCount++
    }
    // Use most common period
    if (s.pmItem.period) sub.period = s.pmItem.period
  }

  return NextResponse.json({
    projectName: project?.name || '',
    month,
    year,
    sections: Object.values(sections).map(sec => ({
      ...sec,
      subCategories: Object.values(sec.subCategories),
    })),
  })
}
