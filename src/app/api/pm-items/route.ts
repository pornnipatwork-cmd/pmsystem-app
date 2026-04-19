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
  const type = searchParams.get('type') // 'EE' | 'ME' | null
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items = await prisma.pMItem.findMany({
    where: {
      projectId,
      ...(type ? { type: type as 'EE' | 'ME' } : {}),
    },
    include: {
      schedules: {
        where: month && year
          ? {
              scheduledDate: {
                gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                lt: new Date(parseInt(year), parseInt(month), 1),
              },
            }
          : undefined,
        orderBy: { scheduledDate: 'asc' },
      },
    },
    orderBy: [{ type: 'asc' }, { category: 'asc' }, { no: 'asc' }],
  })

  return NextResponse.json(items)
}
