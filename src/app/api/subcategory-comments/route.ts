import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canComment, canAccessProject } from '@/lib/permissions'

// GET: ดึง comments ของ project/month/year
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const month = parseInt(searchParams.get('month') || '0')
  const year = parseInt(searchParams.get('year') || '0')

  if (!projectId || !month || !year) {
    return NextResponse.json({ error: 'projectId, month, year required' }, { status: 400 })
  }

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const comments = await prisma.pMSubCategoryComment.findMany({
    where: { projectId, month, year },
    include: { createdBy: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json(comments)
}

// POST: บันทึก/อัปเดต comment
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canComment(session.user.role)) {
    return NextResponse.json({ error: 'เฉพาะ Engineer เท่านั้นที่สามารถ comment ได้' }, { status: 403 })
  }

  const body = await req.json()
  const { projectId, type, category, subCategory, month, year, comment } = body

  if (!projectId || !type || !category || !subCategory || !month || !year) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const projectIds = session.user.projects.map((p) => p.id)
  if (!canAccessProject(session.user.role, projectIds, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // upsert: สร้างใหม่หรืออัปเดต (1 comment ต่อ subCategory ต่อเดือน)
  const result = await prisma.pMSubCategoryComment.upsert({
    where: {
      projectId_type_category_subCategory_month_year: {
        projectId, type, category, subCategory, month, year,
      },
    },
    create: {
      projectId, type, category, subCategory, month, year,
      comment: comment || '',
      createdById: session.user.id,
    },
    update: {
      comment: comment || '',
      createdById: session.user.id,
      updatedAt: new Date(),
    },
    include: { createdBy: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json(result)
}
