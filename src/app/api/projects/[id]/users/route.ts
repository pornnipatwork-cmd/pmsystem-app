import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userProjects = await prisma.userProject.findMany({
    where: { projectId: params.id },
    include: {
      user: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  })

  const users = userProjects.map((up) => ({
    id: up.user.id,
    name: up.user.name,
    username: up.user.username,
    role: up.user.role,
  }))

  return NextResponse.json(users)
}
