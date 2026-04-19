import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isEngineer = session.user.role === 'ENGINEER'
  if (!isAdmin(session.user.role) && !isEngineer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Engineer: can only update name and employeeId, cannot touch Engineers
  if (isEngineer) {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } })
    if (!target || target.role === 'ENGINEER' || target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { name: body.name, employeeId: body.employeeId ?? null },
      select: { id: true, username: true, name: true, employeeId: true, role: true },
    })
    return NextResponse.json(user)
  }

  const { username, password, name, employeeId, role, projectIds } = body

  const updateData: Record<string, unknown> = { username, name, role, employeeId: employeeId || null }
  if (password) {
    updateData.password = await bcrypt.hash(password, 10)
  }

  // Update user and reassign projects
  await prisma.userProject.deleteMany({ where: { userId: params.id } })

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...updateData,
      projects: {
        create: (projectIds || []).map((pid: string) => ({ projectId: pid })),
      },
    },
    include: {
      projects: { include: { project: { select: { id: true, code: true, name: true } } } },
    },
  })

  const { password: _, ...userWithoutPw } = user
  return NextResponse.json(userWithoutPw)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
