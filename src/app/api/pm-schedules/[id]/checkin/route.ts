import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import { calculateStatus } from '@/lib/status'
import { sendCheckInNotify } from '@/lib/line-notify'
import { MAX_FILE_SIZE, compressImage, uploadImage } from '@/lib/upload'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !canEdit(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schedule = await prisma.pMSchedule.findUnique({
    where: { id: params.id },
    include: {
      pmItem: { include: { project: { select: { id: true, lineChannelToken: true, lineGroupId: true } } } },
    },
  })

  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const result = formData.get('result') as 'PASS' | 'FAIL' | null
  const remark = formData.get('remark') as string | null
  const photoFiles = formData.getAll('photos') as File[]
  const fileAttachment = formData.get('file') as File | null

  if (!result) return NextResponse.json({ error: 'result required' }, { status: 400 })

  // ไฟล์แนบยังไม่รองรับบน Vercel (ไม่มี persistent storage)
  if (fileAttachment && fileAttachment.size > 0) {
    return NextResponse.json({ error: 'ไฟล์แนบยังไม่รองรับในเวอร์ชันนี้' }, { status: 400 })
  }

  const photoUrls: string[] = []
  let firstPhotoPublicUrl: string | null = null

  const validPhotos = photoFiles.filter(p => p && p.size > 0).slice(0, 3)
  for (const photo of validPhotos) {
    if (photo.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `ไฟล์รูปภาพใหญ่เกินไป (สูงสุด ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 })
    }
    const rawBuffer = Buffer.from(await photo.arrayBuffer())
    const buffer = await compressImage(rawBuffer)
    const url = await uploadImage(buffer)
    if (url) {
      photoUrls.push(url)
      if (!firstPhotoPublicUrl) firstPhotoPublicUrl = url
    }
  }

  const now = new Date()
  const newStatus = calculateStatus({
    scheduledDate: schedule.scheduledDate,
    result,
    rescheduledDate: null,
  })

  const updated = await prisma.pMSchedule.update({
    where: { id: params.id },
    data: {
      result,
      remark,
      photoUrl: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      fileUrl: null,
      fileName: null,
      checkedAt: now,
      checkedById: session.user.id,
      status: newStatus,
    },
    include: {
      pmItem: true,
      checkedBy: { select: { id: true, name: true } },
    },
  })

  const channelToken = schedule.pmItem.project.lineChannelToken
  const groupId = schedule.pmItem.project.lineGroupId
  if (channelToken && groupId) {
    sendCheckInNotify(channelToken, groupId, {
      machineName: schedule.pmItem.name,
      result,
      photoPublicUrl: firstPhotoPublicUrl,
      checkedByName: session.user.name || '',
      checkedAt: now,
    }).catch(console.error)
  }

  return NextResponse.json({
    ...updated,
    scheduledDate: updated.scheduledDate.toISOString(),
    checkedAt: updated.checkedAt?.toISOString(),
  })
}
