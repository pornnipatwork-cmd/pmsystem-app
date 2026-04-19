import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import { sendTestNotify } from '@/lib/line-notify'

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { name: true, lineChannelToken: true, lineGroupId: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.lineChannelToken || !project.lineGroupId) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า Channel Access Token หรือ Group ID' }, { status: 400 })
  }

  const ok = await sendTestNotify(project.lineChannelToken, project.lineGroupId, project.name)
  if (!ok) return NextResponse.json({ error: 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Token และ Group ID' }, { status: 500 })

  return NextResponse.json({ success: true })
}
