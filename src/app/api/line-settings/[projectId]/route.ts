import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true, lineNotifyTime: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { lineChannelToken, lineGroupId } = body

  const project = await prisma.project.update({
    where: { id: params.projectId },
    data: {
      lineChannelToken: lineChannelToken || null,
      lineGroupId: lineGroupId || null,
    },
    select: { id: true, name: true, lineChannelToken: true, lineGroupId: true },
  })

  return NextResponse.json(project)
}
