import { NextRequest, NextResponse } from 'next/server'
import { runDailyLineTasks } from '@/lib/cron'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await runDailyLineTasks()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[Cron] daily-tasks error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
