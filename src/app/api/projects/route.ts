import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isAdmin(session.user.role)) {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { pmItems: true } },
        users: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    })
    return NextResponse.json(projects)
  }

  // Non-admin: return only assigned projects
  const projectIds = session.user.projects.map((p) => p.id)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { code, name, type, location, description, lineGroupId, lineNotifyTime, color } = body

  if (!code || !name || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.project.findUnique({ where: { code } })
  if (existing) return NextResponse.json({ error: 'Project code already exists' }, { status: 400 })

  const project = await prisma.project.create({
    data: { code, name, type, location, description, lineGroupId, lineNotifyTime, color },
  })
  return NextResponse.json(project, { status: 201 })
}
