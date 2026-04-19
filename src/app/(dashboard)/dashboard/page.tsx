'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { useProjectStore } from '@/store/projectStore'
import { MetricCards } from '@/components/dashboard/MetricCards'
import { PMCalendar } from '@/components/dashboard/PMCalendar'
import { TaskListSidebar } from '@/components/dashboard/TaskListSidebar'
import { getTodayBangkok, THAI_MONTHS } from '@/lib/status'
import { PMScheduleWithItem } from '@/types/pm'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DashboardPage() {
  const { currentProjectId } = useProjectStore()

  const today = getTodayBangkok()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EE' | 'ME'>('ALL')
  const [showTaskList, setShowTaskList] = useState(false)

  const swrKey = currentProjectId
    ? `/api/pm-schedules?projectId=${currentProjectId}&month=${month}&year=${year}`
    : null

  const { data: schedules, isLoading, mutate } = useSWR<PMScheduleWithItem[]>(swrKey, fetcher)

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }, [month])

  const handleSelectDate = useCallback((date: string | null) => {
    setSelectedDate(date)
    if (date) setShowTaskList(true)
  }, [])

  // Calculate metrics
  const list = Array.isArray(schedules) ? schedules : []
  const filteredList = typeFilter === 'ALL' ? list : list.filter((s) => s.pmItem.type === typeFilter)
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const todayCount = filteredList.filter((s) => s.scheduledDate.slice(0, 10) === todayKey && !s.result && !s.rescheduledDate).length
  const doneCount = filteredList.filter((s) => s.status === 'DONE').length
  const overdueCount = filteredList.filter((s) => s.status === 'OVERDUE').length
  const totalCount = filteredList.length

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-pm-text-3">
          <p className="text-[14px]">กรุณาเลือกโครงการจากเมนูด้านบน</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] md:text-[17px] font-semibold text-pm-text">Dashboard</h2>
          <p className="text-[11px] md:text-[12px] text-pm-text-3">ภาพรวมงาน Preventive Maintenance</p>
        </div>
        {/* EE/ME filter */}
        <div className="flex items-center gap-1.5">
          {(['ALL', 'EE', 'ME'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 md:px-3 py-1.5 rounded-md text-[11px] md:text-[12px] border transition-colors ${
                typeFilter === t
                  ? t === 'ALL' ? 'bg-pm-text text-white border-pm-text'
                    : t === 'EE' ? 'bg-pm-ee text-white border-pm-ee'
                    : 'bg-pm-me text-white border-pm-me'
                  : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'
              }`}
            >
              {t === 'ALL' ? 'ทั้งหมด' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <MetricCards
        todayCount={todayCount}
        doneCount={doneCount}
        overdueCount={overdueCount}
        totalCount={totalCount}
        loading={isLoading}
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 hover:bg-pm-bg rounded-md transition-colors">
          <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h3 className="text-[14px] font-semibold text-pm-text">
          {THAI_MONTHS[month - 1]} {year}
        </h3>
        <button onClick={nextMonth} className="p-1.5 hover:bg-pm-bg rounded-md transition-colors">
          <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Calendar + Task list */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Calendar */}
        <div>
          {isLoading ? (
            <div className="bg-pm-card rounded-lg border border-pm-border p-4 h-64 flex items-center justify-center">
              <div className="text-pm-text-3 text-[13px]">กำลังโหลด...</div>
            </div>
          ) : (
            <PMCalendar
              year={year}
              month={month}
              schedules={list}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              typeFilter={typeFilter}
            />
          )}
        </div>

        {/* Task list — desktop: always visible | mobile: modal/bottom sheet */}
        <div className="hidden lg:block h-[520px]">
          <TaskListSidebar
            selectedDate={selectedDate}
            schedules={filteredList}
            onRefresh={() => mutate()}
          />
        </div>
      </div>

      {/* Mobile task list bottom sheet */}
      {showTaskList && selectedDate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setShowTaskList(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-pm-card rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col">
            {/* Handle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pm-border flex-shrink-0">
              <h3 className="text-[14px] font-semibold text-pm-text">รายการวันที่เลือก</h3>
              <button
                onClick={() => setShowTaskList(false)}
                className="p-1 rounded-md hover:bg-pm-bg text-pm-text-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <TaskListSidebar
                selectedDate={selectedDate}
                schedules={filteredList}
                onRefresh={() => mutate()}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
