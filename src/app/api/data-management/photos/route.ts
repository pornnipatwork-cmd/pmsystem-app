import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // รูปภาพเก็บบน ImgBB ซึ่งไม่มี delete API — ลบแค่ใน DB
  const updated = await prisma.pMSchedule.updateMany({
    where: { photoUrl: { not: null } },
    data: { photoUrl: null },
  })

  return NextResponse.json({
    deletedFiles: 0,
    updatedSchedules: updated.count,
    note: 'URL ถูกลบออกจาก DB แล้ว รูปบน ImgBB ยังคงอยู่',
  })
}
