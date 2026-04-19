import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import { sendRescheduleNotify } from '@/lib/line-notify'
import { parseDateTH } from '@/lib/status'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !canEdit(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schedule = await prisma.pMSchedule.findUnique({
    where: { id: params.id },
    include: {
      pmItem: { include: { project: { select: { lineChannelToken: true, lineGroupId: true } } } },
    },
  })

  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { rescheduledDate: rescheduledDateStr, rescheduledRemark } = body

  if (!rescheduledDateStr) {
    return NextResponse.json({ error: 'rescheduledDate required' }, { status: 400 })
  }

  if (!rescheduledRemark?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่นัดหมายใหม่' }, { status: 400 })
  }

  // Accept both ISO and dd/mm/yyyy format
  let rescheduledDate: Date | null = null
  if (rescheduledDateStr.includes('/')) {
    rescheduledDate = parseDateTH(rescheduledDateStr)
  } else {
    rescheduledDate = new Date(rescheduledDateStr)
  }

  if (!rescheduledDate || isNaN(rescheduledDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const updated = await prisma.pMSchedule.update({
    where: { id: params.id },
    data: {
      rescheduledDate,
      rescheduledRemark,
      rescheduledById: session.user.id,
      status: 'RESCHEDULED',
    },
    include: {
      pmItem: true,
      rescheduledBy: { select: { id: true, name: true } },
    },
  })

  // Send Line Messaging API
  const channelToken = schedule.pmItem.project.lineChannelToken
  const groupId = schedule.pmItem.project.lineGroupId
  if (channelToken && groupId) {
    sendRescheduleNotify(channelToken, groupId, {
      machineName: schedule.pmItem.name,
      newDate: rescheduledDate,
      remark: rescheduledRemark || '',
      rescheduledByName: session.user.name || '',
    }).catch(console.error)
  }

  return NextResponse.json({
    ...updated,
    scheduledDate: updated.scheduledDate.toISOString(),
    rescheduledDate: updated.rescheduledDate?.toISOString(),
  })
}
