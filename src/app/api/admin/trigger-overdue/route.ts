import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateOverdueStatuses } from '@/lib/cron'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const updatedCount = await updateOverdueStatuses()
    return NextResponse.json({ ok: true, updatedCount })
  } catch (error) {
    console.error('[Admin] trigger-overdue error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
