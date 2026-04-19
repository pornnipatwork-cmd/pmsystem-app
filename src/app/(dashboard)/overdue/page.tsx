'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useProjectStore } from '@/store/projectStore'
import { PMScheduleWithItem } from '@/types/pm'
import { formatDateTH, getTodayBangkok, THAI_MONTHS, fmtChemName } from '@/lib/status'
import { useSession } from 'next-auth/react'
import { canEdit } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function OverdueCard({
  schedule,
  editable,
  onSuccess,
}: {
  schedule: PMScheduleWithItem
  editable: boolean
  onSuccess: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = getTodayBangkok()
  const scheduled = new Date(schedule.scheduledDate)
  const daysOverdue = Math.floor((today.getTime() - scheduled.getTime()) / (1000 * 60 * 60 * 24))

  const handleReschedule = async () => {
    if (!newDate) { setError('กรุณาระบุวันนัดหมายใหม่'); return }
    if (!remark.trim()) { setError('กรุณาระบุเหตุผลที่นัดหมายใหม่'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/pm-schedules/${schedule.id}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rescheduledDate: newDate, rescheduledRemark: remark }),
    })
    setLoading(false)
    if (res.ok) onSuccess()
    else {
      const data = await res.json()
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {schedule.pmItem.no != null && (
                <span className="text-[10px] font-mono text-pm-text-3 bg-pm-bg px-1.5 py-0.5 rounded">
                  #{schedule.pmItem.no}
                </span>
              )}
              <span className="text-[11px] text-pm-text-3">{schedule.pmItem.number}</span>
            </div>
            <div className="text-[14px] font-medium text-pm-text">{fmtChemName(schedule.pmItem.name)}</div>
            {schedule.pmItem.location && (
              <div className="text-[11px] text-pm-text-3 mt-0.5">📍 {schedule.pmItem.location}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[11px] text-pm-text-3 mb-1">กำหนดเดิม</div>
            <div className="text-[13px] font-medium text-pm-text">{formatDateTH(schedule.scheduledDate)}</div>
            <div className="text-[12px] text-danger font-medium mt-1 bg-danger-light px-2 py-0.5 rounded">
              เกิน {daysOverdue} วัน
            </div>
          </div>
        </div>

        {editable && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`mt-3 w-full py-2 text-[12px] font-medium rounded-md border transition-colors ${
              showForm
                ? 'bg-warn text-white border-warn'
                : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'
            }`}
          >
            {showForm ? '▲ ซ่อนฟอร์ม' : '📅 นัดหมายใหม่'}
          </button>
        )}
      </div>

      {showForm && editable && (
        <div className="px-4 pb-4 bg-warn-light border-t border-warn/20 space-y-3">
          <div className="pt-3">
            <label className="text-[11px] font-medium text-pm-text-2 block mb-1.5">วันนัดหมายใหม่ *</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={getTodayBangkok().toISOString().slice(0, 10)}
              max={(() => { const t = getTodayBangkok(); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) })()}
              className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] outline-none focus:border-warn bg-pm-card"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 block mb-1.5">เหตุผล / หมายเหตุ *</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] outline-none focus:border-warn resize-none bg-pm-card"
              placeholder="ระบุเหตุผลที่นัดหมายใหม่"
            />
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <button
            onClick={handleReschedule}
            disabled={loading}
            className="w-full py-2 bg-warn text-white rounded-md text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
          >
            {loading ? 'กำลังบันทึก...' : 'ยืนยันวันนัดหมายใหม่'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function OverduePage() {
  const { currentProjectId } = useProjectStore()
  const { data: session } = useSession()
  const editable = canEdit(session?.user?.role ?? '')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EE' | 'ME'>('ALL')

  const today = getTodayBangkok()
  const monthLabel = `${THAI_MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`

  const { data: schedules, isLoading, mutate } = useSWR<PMScheduleWithItem[]>(
    currentProjectId ? `/api/pm-schedules?projectId=${currentProjectId}&status=OVERDUE` : null,
    fetcher
  )

  const list = Array.isArray(schedules) ? schedules : []

  const filtered = useMemo(() =>
    [...list]
      .filter(s => typeFilter === 'ALL' || s.pmItem.type === typeFilter)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
    [list, typeFilter]
  )

  // จัดกลุ่ม 3 Level: type+category → subCategory → items
  const grouped = useMemo(() => {
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
      const subKey = s.pmItem.subCategory || ''
      if (!map[catKey].subGroups[subKey]) map[catKey].subGroups[subKey] = []
      map[catKey].subGroups[subKey].push(s)
    }
    for (const cat of Object.values(map)) {
      for (const subKey of Object.keys(cat.subGroups)) {
        cat.subGroups[subKey].sort((a, b) => (a.pmItem.no ?? 0) - (b.pmItem.no ?? 0))
      }
    }
    return map
  }, [filtered])

  if (!currentProjectId) {
    return <div className="flex items-center justify-center h-64 text-pm-text-3">กรุณาเลือกโครงการ</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[17px] font-semibold text-pm-text">งานค้าง (Overdue)</h2>
          <p className="text-[12px] text-pm-text-3">
            รายการที่เกินกำหนดการตรวจ
            <span className="ml-2 px-2 py-0.5 bg-danger-light text-danger rounded-full text-[11px] font-medium border border-red-200">
              {monthLabel}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-pm-text-3">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-pm-card rounded-lg border border-pm-border p-12 text-center">
          <div className="text-[32px] mb-3">✅</div>
          <div className="text-[15px] font-medium text-pm-text mb-1">ไม่มีงานค้าง</div>
          <div className="text-[13px] text-pm-text-3">ทุกรายการได้รับการตรวจสอบแล้ว</div>
        </div>
      ) : (
        <>
          <div className="mb-4 text-[13px] text-danger font-medium">
            พบ {filtered.length} รายการที่เกินกำหนด
          </div>

          <div className="space-y-4">
            {Object.entries(grouped).map(([catKey, catData]) => (
              <div key={catKey} className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
                {/* Level 1: หมวดหมู่หลัก */}
                <div className="px-4 py-2.5 bg-pm-bg border-b border-pm-border flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    catData.type === 'EE' ? 'bg-blue-100 text-pm-ee' : 'bg-purple-100 text-pm-me'
                  }`}>
                    {catData.type}
                  </span>
                  <span className="text-[13px] font-semibold text-pm-text">{catData.category}</span>
                  <span className="text-[11px] text-danger ml-auto font-medium">
                    {Object.values(catData.subGroups).flat().length} รายการค้าง
                  </span>
                </div>

                {Object.entries(catData.subGroups).map(([subKey, items]) => (
                  <div key={subKey}>
                    {/* Level 2: หมวดหมู่ย่อย */}
                    {subKey && (
                      <div className="px-4 py-2 bg-pm-bg/40 border-b border-pm-border/50">
                        <span className="text-[11px] text-pm-text-2 font-medium">▸ {subKey}</span>
                        <span className="text-[10px] text-pm-text-3 ml-2">({items.length} รายการ)</span>
                      </div>
                    )}

                    {/* Level 3: รายการ */}
                    <div className="p-3 space-y-3">
                      {items.map(schedule => (
                        <OverdueCard
                          key={schedule.id}
                          schedule={schedule}
                          editable={editable}
                          onSuccess={() => mutate()}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
