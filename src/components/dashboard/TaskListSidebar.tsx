'use client'

import { useMemo, useState } from 'react'
import { PMScheduleWithItem } from '@/types/pm'
import { formatDateTH, THAI_MONTHS, fmtChemName } from '@/lib/status'
import { canEdit } from '@/lib/permissions'
import { useSession } from 'next-auth/react'
import { InlineCheckInForm } from './InlineCheckInForm'

interface TaskListSidebarProps {
  selectedDate: string | null
  schedules: PMScheduleWithItem[]
  onRefresh: () => void
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    TODAY:       { label: 'วันนี้',     cls: 'bg-info-light text-info border-blue-200' },
    UPCOMING:    { label: 'รอตรวจ',    cls: 'bg-pm-bg text-pm-text-2 border-pm-border' },
    DONE:        { label: 'ตรวจแล้ว', cls: 'bg-green-100 text-green-700 border-green-200' },
    OVERDUE:     { label: 'ค้าง',      cls: 'bg-danger-light text-danger border-red-200' },
    RESCHEDULED: { label: 'นัดใหม่',   cls: 'bg-warn-light text-warn border-orange-200' },
  }
  const s = map[status] || { label: status, cls: '' }
  return (
    <span className={`inline-flex text-[10px] px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function TaskListSidebar({ selectedDate, schedules, onRefresh }: TaskListSidebarProps) {
  const { data: session } = useSession()
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set())
  const editable = canEdit(session?.user?.role ?? '')

  const toggleSub = (key: string) => {
    setCollapsedSubs(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  /* ── กรองเฉพาะวันที่เลือก ── */
  const daySchedules = useMemo(() => {
    if (!selectedDate) return []
    return schedules.filter((s) => {
      const d = (s.status === 'RESCHEDULED' && s.rescheduledDate)
        ? s.rescheduledDate.slice(0, 10)
        : s.scheduledDate.slice(0, 10)
      return d === selectedDate
    })
  }, [schedules, selectedDate])

  /* ── จัดกลุ่ม 3 Level: category → subCategory → items ── */
  const grouped = useMemo(() => {
    const map: Record<string, {
      type: string
      category: string
      subGroups: Record<string, PMScheduleWithItem[]>
    }> = {}
    for (const s of daySchedules) {
      const catKey = `${s.pmItem.type}__${s.pmItem.category}`
      if (!map[catKey])
        map[catKey] = { type: s.pmItem.type, category: s.pmItem.category, subGroups: {} }
      const sub = s.pmItem.subCategory || ''
      if (!map[catKey].subGroups[sub]) map[catKey].subGroups[sub] = []
      map[catKey].subGroups[sub].push(s)
    }
    for (const cat of Object.values(map))
      for (const sub of Object.keys(cat.subGroups))
        cat.subGroups[sub].sort((a, b) => (a.pmItem.no ?? 0) - (b.pmItem.no ?? 0))
    return map
  }, [daySchedules])

  /* ── Empty state ── */
  if (!selectedDate) {
    return (
      <div className="bg-pm-card rounded-lg border border-pm-border h-full flex items-center justify-center p-8">
        <div className="text-center text-pm-text-3">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-[13px]">เลือกวันในปฏิทิน<br/>เพื่อดูรายการ</p>
        </div>
      </div>
    )
  }

  const [y, m, d] = selectedDate.split('-').map(Number)
  const dateLabel  = `${d} ${THAI_MONTHS[m - 1]} ${y}`
  const doneTotal  = daySchedules.filter(s => s.status === 'DONE').length

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border flex flex-col h-full">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-pm-border">
        <div className="text-[13px] font-semibold text-pm-text">{dateLabel}</div>
        <div className="text-[11px] text-pm-text-3 mt-0.5">
          {doneTotal}/{daySchedules.length} รายการตรวจแล้ว
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {daySchedules.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8 text-pm-text-3 text-[13px]">
            ไม่มีรายการในวันนี้
          </div>
        ) : (
          Object.entries(grouped).map(([catKey, catData]) => {
            const allItems   = Object.values(catData.subGroups).flat()
            const catDone    = allItems.filter(s => s.status === 'DONE').length

            return (
              <div key={catKey}>

                {/* ══ Level 1: หมวดหมู่หลัก ══ */}
                <div className="px-3 py-2 bg-pm-muted border-b border-pm-border sticky top-0 z-10 flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    catData.type === 'EE' ? 'bg-blue-100 text-pm-ee' : 'bg-purple-100 text-pm-me'
                  }`}>
                    {catData.type}
                  </span>
                  <span className="text-[12px] font-bold text-pm-text uppercase tracking-wide flex-1">
                    {catData.category}
                  </span>
                  <span className="text-[10px] text-pm-text-3">{catDone}/{allItems.length}</span>
                </div>

                {Object.entries(catData.subGroups).map(([subKey, items]) => {
                  const collapseKey = `${catKey}__${subKey}`
                  const collapsed   = collapsedSubs.has(collapseKey)
                  const subDone     = items.filter(s => s.status === 'DONE').length

                  return (
                    <div key={subKey}>

                      {/* ══ Level 2: หมวดหมู่ย่อย — คลิกยุบ/ขยาย ══ */}
                      {subKey ? (
                        <div
                          className="px-3 py-2 bg-pm-bg border-b border-pm-border/70 flex items-center gap-2 cursor-pointer select-none hover:bg-pm-bg/60 transition-colors"
                          onClick={() => toggleSub(collapseKey)}
                        >
                          <svg
                            className={`w-3 h-3 text-pm-text-3 flex-shrink-0 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                          </svg>
                          <span className="text-[11px] font-semibold text-pm-text-2 flex-1">{subKey}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            subDone === items.length
                              ? 'bg-accent-light text-accent-dark border-green-200'
                              : 'bg-pm-card text-pm-text-3 border-pm-border'
                          }`}>
                            {subDone}/{items.length}
                          </span>
                        </div>
                      ) : null}

                      {/* ══ Level 3: รายการ ══ */}
                      {!collapsed && items.map((schedule) => {
                        const displayDate = (schedule.status === 'RESCHEDULED' && schedule.rescheduledDate)
                          ? schedule.rescheduledDate
                          : schedule.scheduledDate
                        const canExpand = editable && schedule.status !== 'DONE'

                        return (
                          <div key={schedule.id} className="border-b border-pm-border/50 last:border-0">
                            <div
                              className={`flex items-start gap-2 px-3 py-2.5 ${subKey ? 'pl-5' : ''} ${canExpand ? 'cursor-pointer hover:bg-pm-bg' : ''} transition-colors`}
                              onClick={() => canExpand && setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                            >
                              {/* running number */}
                              <div className="w-5 text-[11px] text-pm-text-3 text-right flex-shrink-0 pt-0.5 font-mono">
                                {schedule.pmItem.no}.
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-medium text-pm-text leading-snug">
                                  {fmtChemName(schedule.pmItem.name)}
                                </div>
                                {schedule.pmItem.number && (
                                  <div className="text-[10px] text-pm-text-3">{schedule.pmItem.number}</div>
                                )}
                                {schedule.pmItem.location && (
                                  <div className="text-[10px] text-pm-text-3 mt-0.5">📍 {schedule.pmItem.location}</div>
                                )}
                                {schedule.status === 'DONE' && schedule.checkedBy && (
                                  <div className="text-[10px] text-accent-dark mt-0.5">
                                    ✓ {schedule.checkedBy.name} · {schedule.result === 'PASS' ? 'ปกติ' : 'ผิดปกติ'}
                                  </div>
                                )}
                                {schedule.status === 'RESCHEDULED' && schedule.rescheduledDate && (
                                  <div className="text-[10px] text-warn mt-0.5">
                                    📅 นัดใหม่: {formatDateTH(schedule.rescheduledDate)}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <StatusBadge status={schedule.status} />
                                <span className="text-[10px] text-pm-text-3">{formatDateTH(displayDate)}</span>
                              </div>
                            </div>

                            {expandedId === schedule.id && editable && schedule.status !== 'DONE' && (
                              <div className="px-3 pb-3 bg-pm-bg">
                                <InlineCheckInForm
                                  schedule={schedule}
                                  onSuccess={() => { setExpandedId(null); onRefresh() }}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
