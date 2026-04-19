'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { useProjectStore } from '@/store/projectStore'
import { PMScheduleWithItem } from '@/types/pm'
import { formatDateTH, getTodayBangkok, THAI_MONTHS, fmtChemName } from '@/lib/status'
import { useSession } from 'next-auth/react'
import { canEdit } from '@/lib/permissions'
import { InlineCheckInForm } from '@/components/dashboard/InlineCheckInForm'
import { SubCategoryComment } from '@/components/schedule/SubCategoryComment'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface SubCatComment {
  id: string
  type: string
  category: string
  subCategory: string
  comment: string
  createdBy: { id: string; name: string; role: string }
  updatedAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TODAY: { label: 'วันนี้', color: 'bg-info-light text-info border-blue-200' },
  UPCOMING: { label: 'รอตรวจ', color: 'bg-pm-bg text-pm-text-2 border-pm-border' },
  DONE: { label: 'ตรวจแล้ว', color: 'bg-green-100 text-green-700 border-green-200' },
  OVERDUE: { label: 'ค้าง', color: 'bg-danger-light text-danger border-red-200' },
  RESCHEDULED: { label: 'นัดใหม่', color: 'bg-warn-light text-warn border-orange-200' },
}

export default function SchedulePage() {
  const { currentProjectId } = useProjectStore()
  const { data: session } = useSession()
  const editable = canEdit(session?.user?.role ?? '')

  const today = getTodayBangkok()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EE' | 'ME'>('ALL')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set())

  const toggleSub = (key: string) => {
    setCollapsedSubs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const { data: schedules, isLoading, mutate } = useSWR<PMScheduleWithItem[]>(
    currentProjectId
      ? `/api/pm-schedules?projectId=${currentProjectId}&month=${month}&year=${year}`
      : null,
    fetcher
  )

  const { data: commentsData, mutate: mutateComments } = useSWR<SubCatComment[]>(
    currentProjectId
      ? `/api/subcategory-comments?projectId=${currentProjectId}&month=${month}&year=${year}`
      : null,
    fetcher
  )

  // Map comment by "type__category__subCategory" key
  const commentMap = useMemo(() => {
    const map: Record<string, SubCatComment> = {}
    for (const c of (Array.isArray(commentsData) ? commentsData : [])) {
      map[`${c.type}__${c.category}__${c.subCategory}`] = c
    }
    return map
  }, [commentsData])

  const list = Array.isArray(schedules) ? schedules : []

  // typeFiltered = กรองแค่ประเภท EE/ME (ไม่กรองสถานะ) → ใช้คำนวณ counts
  const typeFiltered = useMemo(() =>
    list.filter(s => typeFilter === 'ALL' || s.pmItem.type === typeFilter),
    [list, typeFilter]
  )

  // คำนวณ sub-categories ที่ต้อง Engineer comment (allDone + hasFail + ไม่มี comment)
  const needCommentSubKeys = useMemo(() => {
    const groups: Record<string, PMScheduleWithItem[]> = {}
    for (const s of typeFiltered) {
      const key = `${s.pmItem.type}__${s.pmItem.category}__${s.pmItem.subCategory || ''}`
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    }
    const keys = new Set<string>()
    for (const [key, items] of Object.entries(groups)) {
      const allDone = items.every(s => s.status === 'DONE')
      const hasFail = items.some(s => s.result === 'FAIL')
      const hasComment = !!commentMap[key]
      if (allDone && hasFail && !hasComment) keys.add(key)
    }
    return keys
  }, [typeFiltered, commentMap])

  // counts คำนวณจาก typeFiltered เสมอ (ไม่ขึ้นกับ statusFilter)
  const counts = useMemo(() => ({
    total: typeFiltered.length,
    done: typeFiltered.filter(s => s.status === 'DONE').length,
    pending: typeFiltered.filter(s => s.status === 'UPCOMING' || s.status === 'TODAY').length,
    overdue: typeFiltered.filter(s => s.status === 'OVERDUE').length,
    needComment: needCommentSubKeys.size,
  }), [typeFiltered, needCommentSubKeys])

  // filtered = กรองทั้งประเภทและสถานะ → ใช้แสดงรายการ
  const filtered = useMemo(() => {
    return typeFiltered.filter(s => {
      if (!statusFilter) return true
      if (statusFilter === 'PENDING') return s.status === 'UPCOMING' || s.status === 'TODAY'
      if (statusFilter === 'NEED_COMMENT') {
        const key = `${s.pmItem.type}__${s.pmItem.category}__${s.pmItem.subCategory || ''}`
        return needCommentSubKeys.has(key)
      }
      return s.status === statusFilter
    })
  }, [typeFiltered, statusFilter, needCommentSubKeys])

  // จัดกลุ่ม 3 Level: type+category → subCategory → items
  const grouped = useMemo(() => {
    // Level 1: type__category
    const map: Record<string, {
      type: string
      category: string
      subGroups: Record<string, PMScheduleWithItem[]>
    }> = {}

    for (const s of filtered) {
      const catKey = `${s.pmItem.type}__${s.pmItem.category}`
      if (!map[catKey]) {
        map[catKey] = { type: s.pmItem.type, category: s.pmItem.category, subGroups: {} }
      }
      // Level 2: subCategory (ถ้าไม่มีให้ใช้ '' เป็น key)
      const subKey = s.pmItem.subCategory || ''
      if (!map[catKey].subGroups[subKey]) map[catKey].subGroups[subKey] = []
      map[catKey].subGroups[subKey].push(s)
    }

    // Sort items within each subGroup by pmItem.no
    for (const cat of Object.values(map)) {
      for (const subKey of Object.keys(cat.subGroups)) {
        cat.subGroups[subKey].sort((a, b) => (a.pmItem.no ?? 0) - (b.pmItem.no ?? 0))
      }
    }
    return map
  }, [filtered])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  if (!currentProjectId) {
    return <div className="flex items-center justify-center h-64 text-pm-text-3">กรุณาเลือกโครงการ</div>
  }

  return (
    <div>
      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] md:text-[17px] font-semibold text-pm-text">ตารางงาน PM</h2>
          <p className="text-[11px] md:text-[12px] text-pm-text-3">รายการตรวจบำรุงรักษาประจำเดือน</p>
        </div>
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 border border-pm-border rounded-md hover:bg-pm-bg">
            <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="text-[14px] font-medium text-pm-text px-2 min-w-[110px] text-center">{THAI_MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 border border-pm-border rounded-md hover:bg-pm-bg">
            <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Tabs + Pills */}
      <div className="bg-pm-card rounded-lg border border-pm-border p-3 md:p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {/* Type tabs */}
          <div className="flex gap-1">
            {(['ALL', 'EE', 'ME'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${
                  typeFilter === t
                    ? t === 'EE' ? 'bg-pm-ee text-white border-pm-ee'
                      : t === 'ME' ? 'bg-pm-me text-white border-pm-me'
                      : 'bg-pm-text text-white border-pm-text'
                    : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'
                }`}
              >
                {t === 'ALL' ? 'ทั้งหมด' : t}
              </button>
            ))}
          </div>

          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: null,            label: `รวม ${counts.total}`,                             cls: 'bg-pm-bg text-pm-text-2 border-pm-border' },
              { key: 'DONE',          label: `ตรวจแล้ว ${counts.done}`,                        cls: 'bg-green-100 text-green-700 border-green-200' },
              { key: 'PENDING',       label: `รอตรวจ ${counts.pending}`,                       cls: 'bg-info-light text-info border-blue-200' },
              { key: 'OVERDUE',       label: `ค้าง ${counts.overdue}`,                         cls: 'bg-danger-light text-danger border-red-200' },
              { key: 'NEED_COMMENT',  label: `รายการผิดปกติ รอ Engineer Comment ${counts.needComment}`, cls: 'bg-accent-light text-accent-dark border-yellow-300' },
            ].map(({ key, label, cls }) => (
              <button key={String(key)} onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-full text-[11px] border font-medium transition-opacity ${cls} ${statusFilter === key ? '' : 'opacity-60 hover:opacity-90'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule list */}
      {isLoading ? (
        <div className="bg-pm-card rounded-lg border border-pm-border p-8 text-center text-pm-text-3">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-pm-card rounded-lg border border-pm-border p-8 text-center text-pm-text-3">ไม่พบรายการ</div>
      ) : (
        Object.entries(grouped).map(([catKey, { type, category, subGroups }]) => {
          const totalItems = Object.values(subGroups).reduce((n, arr) => n + arr.length, 0)
          return (
            <div key={catKey} className="bg-pm-card rounded-lg border border-pm-border mb-3 overflow-hidden">
              {/* Level 1: Category header */}
              <div className="px-3 md:px-4 py-2.5 bg-pm-muted border-b border-pm-border flex items-center gap-2">
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${type === 'EE' ? 'bg-blue-100 text-pm-ee' : 'bg-purple-100 text-pm-me'}`}>{type}</span>
                <span className="text-[12px] md:text-[13px] font-semibold text-pm-text uppercase tracking-wide">{category}</span>
                <span className="text-[11px] text-pm-text-3">({totalItems})</span>
              </div>

              {/* Level 2 + 3: subGroups */}
              {Object.entries(subGroups).map(([subCat, items]) => {
                const subKey = `${catKey}__${subCat}`
                const isCollapsed = collapsedSubs.has(subKey)
                const doneCount = items.filter(s => s.status === 'DONE').length

                return (
                <div key={subCat}>
                  {/* Level 2: SubCategory header — คลิกเพื่อยุบ/ขยาย */}
                  {subCat && (
                    <div
                      className="px-3 md:px-4 py-2 bg-pm-bg border-b border-pm-border flex items-center gap-2 cursor-pointer select-none hover:bg-pm-bg/80 transition-colors"
                      onClick={() => toggleSub(subKey)}
                    >
                      <svg
                        className={`w-3.5 h-3.5 text-pm-text-3 transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                      <span className="text-[12px] font-medium text-pm-text-2 flex-1">{subCat}</span>
                      <span className="text-[10px] text-pm-text-3 bg-pm-card px-2 py-0.5 rounded-full border border-pm-border">
                        {doneCount}/{items.length} ตรวจแล้ว
                      </span>
                    </div>
                  )}

                  {!isCollapsed && (
                    <>
                  {/* Engineer Comment (แสดงเมื่อทุก item ใน subCat ตรวจเสร็จแล้ว หรือมี comment อยู่แล้ว) */}
                  {subCat && currentProjectId && (() => {
                    const allDone = items.every(s => s.status === 'DONE')
                    const hasFail = items.some(s => s.result === 'FAIL')
                    const commentKey = `${type}__${category}__${subCat}`
                    const existing = commentMap[commentKey] ?? null
                    return (
                      <SubCategoryComment
                        projectId={currentProjectId}
                        type={type}
                        category={category}
                        subCategory={subCat}
                        month={month}
                        year={year}
                        existingComment={existing}
                        allDone={allDone}
                        hasFail={hasFail}
                        onSaved={() => mutateComments()}
                      />
                    )
                  })()}

                  {/* Level 3: Items */}
                  {items.map(schedule => {
                    const displayDate = (schedule.status === 'RESCHEDULED' && schedule.rescheduledDate)
                      ? schedule.rescheduledDate
                      : schedule.scheduledDate
                    return (
                      <div key={schedule.id} className="border-b border-pm-border last:border-0">
                        <div
                          className={`flex items-start md:items-center gap-2 md:gap-3 px-3 md:px-4 py-3 ${subCat ? 'pl-6 md:pl-8' : ''} ${editable ? 'cursor-pointer hover:bg-pm-bg' : ''}`}
                          onClick={() => editable && setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                        >
                          {/* ใช้ pmItem.no จาก Excel เป็น running number */}
                          <div className="w-5 md:w-6 text-[11px] md:text-[12px] text-pm-text-3 text-right flex-shrink-0 mt-0.5">{schedule.pmItem.no}.</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="text-[13px] font-medium text-pm-text">{fmtChemName(schedule.pmItem.name)}</span>
                              <span className="text-[11px] text-pm-text-3">{schedule.pmItem.number}</span>
                            </div>
                            {schedule.pmItem.location && (
                              <div className="text-[11px] text-pm-text-3">{schedule.pmItem.location}</div>
                            )}
                            {/* Date + status — shown below on mobile */}
                            <div className="flex items-center gap-2 mt-1 md:hidden">
                              <span className="text-[11px] text-pm-text-3">{formatDateTH(displayDate)}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_LABELS[schedule.status]?.color || ''}`}>
                                {STATUS_LABELS[schedule.status]?.label || schedule.status}
                              </span>
                            </div>
                          </div>
                          {/* Date + status — shown right on desktop */}
                          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] text-pm-text-3">{formatDateTH(displayDate)}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_LABELS[schedule.status]?.color || ''}`}>
                              {STATUS_LABELS[schedule.status]?.label || schedule.status}
                            </span>
                          </div>
                        </div>

                        {expandedId === schedule.id && editable && (
                          <div className="px-3 md:px-4 pb-4 bg-pm-bg">
                            <InlineCheckInForm
                              schedule={schedule}
                              onSuccess={() => { setExpandedId(null); mutate() }}
                              pdfOnly
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                    </>
                  )}
                </div>
              )})}
            </div>
          )
        })
      )}
    </div>
  )
}
