'use client'

import { useMemo } from 'react'
import { PMScheduleWithItem } from '@/types/pm'
import { getTodayBangkok } from '@/lib/status'

interface PMCalendarProps {
  year: number
  month: number
  schedules: PMScheduleWithItem[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  typeFilter: 'ALL' | 'EE' | 'ME'
}

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function getDayStats(schedules: PMScheduleWithItem[]) {
  const stats: Record<string, { overdue: number; today: number; done: number; upcoming: number; rescheduled: number }> = {}
  for (const s of schedules) {
    // RESCHEDULED items แสดงที่วันนัดใหม่ ไม่ใช่วันเดิม
    const key = (s.status === 'RESCHEDULED' && s.rescheduledDate)
      ? s.rescheduledDate.slice(0, 10)
      : s.scheduledDate.slice(0, 10)
    if (!stats[key]) stats[key] = { overdue: 0, today: 0, done: 0, upcoming: 0, rescheduled: 0 }
    const st = s.status
    if (st === 'OVERDUE') stats[key].overdue++
    else if (st === 'TODAY') stats[key].today++
    else if (st === 'DONE') stats[key].done++
    else if (st === 'UPCOMING') stats[key].upcoming++
    else if (st === 'RESCHEDULED') stats[key].rescheduled++
  }
  return stats
}

export function PMCalendar({ year, month, schedules, selectedDate, onSelectDate, typeFilter }: PMCalendarProps) {
  const today = getTodayBangkok()
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`

  const filtered = useMemo(
    () => (typeFilter === 'ALL' ? schedules : schedules.filter((s) => s.pmItem.type === typeFilter)),
    [schedules, typeFilter]
  )

  const dayStats = useMemo(() => getDayStats(filtered), [filtered])

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[11px] text-pm-text-3 py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-10" />
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const stats = dayStats[dateKey]
          const isToday = dateKey === todayKey
          const isPast = new Date(Date.UTC(year, month - 1, day)) < today
          const isSelected = dateKey === selectedDate
          const hasItems = !!stats

          let dotColor = ''
          if (stats) {
            if (stats.overdue > 0) dotColor = 'bg-danger'
            else if (stats.today > 0) dotColor = 'bg-info'
            else if (stats.upcoming > 0) dotColor = 'bg-info'
            else if (stats.done > 0) dotColor = isPast ? 'bg-green-400' : 'bg-green-500'
            else if (stats.rescheduled > 0) dotColor = 'bg-warn'
          }

          let bg = ''
          if (isSelected) bg = 'bg-info text-white'
          else if (isToday) bg = 'bg-info text-white'
          else if (stats?.overdue && stats.overdue > 0 && !isSelected) bg = 'bg-danger-light'
          else bg = 'hover:bg-pm-bg'

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className={`h-10 flex flex-col items-center justify-center rounded-md text-[12px] transition-colors cursor-pointer ${bg} ${
                !isToday && !isSelected ? 'text-pm-text' : ''
              }`}
            >
              <span className={`font-medium ${isToday || isSelected ? '' : ''}`}>{day}</span>
              {dotColor && !isSelected && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-pm-border text-[11px] text-pm-text-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block"/> ค้าง</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info inline-block"/> รอตรวจ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> ตรวจแล้ว</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn inline-block"/> นัดใหม่</span>
      </div>
    </div>
  )
}
