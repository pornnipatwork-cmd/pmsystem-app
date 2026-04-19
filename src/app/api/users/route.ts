import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isEngineer = session.user.role === 'ENGINEER'
  if (!isAdmin(session.user.role) && !isEngineer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Engineer: show only users in their projects, exclude other Engineers
  const where: Record<string, unknown> = { role: { not: 'SUPER_ADMIN' } }
  if (isEngineer) {
    const engineerProjects = await prisma.userProject.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    })
    const projectIds = engineerProjects.map((up) => up.projectId)
    where.role = { notIn: ['SUPER_ADMIN', 'ENGINEER'] }
    where.projects = { some: { projectId: { in: projectIds } } }
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, username: true, name: true, employeeId: true, role: true, createdAt: true,
      projects: { include: { project: { select: { id: true, code: true, name: true, type: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { username, password, name, employeeId, role, projectIds } = body

  if (!username || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 400 })

  const hashed = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      username,
      password: hashed,
      name,
      employeeId: employeeId || null,
      role,
      projects: {
        create: (projectIds || []).map((pid: string) => ({ projectId: pid })),
      },
    },
    include: {
      projects: { include: { project: { select: { id: true, code: true, name: true } } } },
    },
  })

  const { password: _, ...userWithoutPw } = user
  return NextResponse.json(userWithoutPw, { status: 201 })
}
