'use client'

import { useState } from 'react'
import useSWR from 'swr'
import SuperAdminGuard from '@/components/layout/SuperAdminGuard'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })

interface UsageUser { id: string; name: string; username: string; role: string }
interface UsageProject {
  projectId: string; projectName: string; projectCode: string; projectColor: string
  checkCount: number; users: UsageUser[]
}
interface DailyRow { date: string; checkCount: number; projectCount: number; userCount: number }
interface UsageData {
  from: string; to: string
  totalProjects: number; totalUsers: number; totalChecks: number
  projects: UsageProject[]; daily: DailyRow[]
}

function UsageContent() {
  const today = todayString()
  const [mode, setMode] = useState<'day' | 'range'>('day')
  const [selectedDate, setSelectedDate] = useState(today)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [toDate, setToDate] = useState(today)

  const apiUrl = mode === 'day'
    ? `/api/admin/usage?from=${selectedDate}&to=${selectedDate}`
    : `/api/admin/usage?from=${fromDate}&to=${toDate}`

  const { data, isLoading, error } = useSWR<UsageData>(apiUrl, fetcher)

  const totalChecks = data?.totalChecks ?? 0

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pm-text">สถิติการใช้งาน</h2>
        <p className="text-[12px] text-pm-text-3">ดูข้อมูลผู้ใช้และโครงการที่มีการตรวจ PM</p>
      </div>

      {/* Mode toggle + date pickers */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        {/* Toggle */}
        <div className="flex rounded-md border border-pm-border overflow-hidden text-[12px]">
          <button
            onClick={() => setMode('day')}
            className={`px-4 py-2 font-medium transition-colors ${mode === 'day' ? 'bg-accent text-white' : 'bg-pm-card text-pm-text-2 hover:bg-pm-bg'}`}
          >
            รายวัน
          </button>
          <button
            onClick={() => setMode('range')}
            className={`px-4 py-2 font-medium transition-colors border-l border-pm-border ${mode === 'range' ? 'bg-accent text-white' : 'bg-pm-card text-pm-text-2 hover:bg-pm-bg'}`}
          >
            ช่วงเวลา
          </button>
        </div>

        {mode === 'day' ? (
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-card outline-none focus:border-accent"
          />
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-card outline-none focus:border-accent"
            />
            <span className="text-[12px] text-pm-text-3">ถึง</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-card outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3">
        <div className="bg-pm-bg rounded-lg p-4 border border-pm-border">
          <div className="text-[11px] text-pm-text-3 mb-1">โครงการที่มีการใช้งาน</div>
          <div className="text-[28px] font-semibold text-pm-text">{isLoading ? '...' : (data?.totalProjects ?? 0)}</div>
        </div>
        <div className="bg-pm-bg rounded-lg p-4 border border-pm-border">
          <div className="text-[11px] text-pm-text-3 mb-1">ผู้ใช้งานระบบ</div>
          <div className="text-[28px] font-semibold text-pm-text">{isLoading ? '...' : (data?.totalUsers ?? 0)}</div>
        </div>
        <div className="bg-pm-bg rounded-lg p-4 border border-pm-border col-span-2 sm:col-span-1">
          <div className="text-[11px] text-pm-text-3 mb-1">รายการตรวจรวม</div>
          <div className="text-[28px] font-semibold text-accent">{isLoading ? '...' : totalChecks}</div>
        </div>
      </div>

      {isLoading && <div className="py-12 text-center text-[13px] text-pm-text-3">กำลังโหลด...</div>}
      {error && <div className="py-12 text-center text-[13px] text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>}

      {!isLoading && !error && data && (
        <>
          {/* Daily breakdown table — show only in range mode or when range > 1 day */}
          {mode === 'range' && data.daily.length > 1 && (
            <div className="bg-pm-card rounded-lg border border-pm-border overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-pm-border bg-pm-bg">
                <span className="text-[13px] font-semibold text-pm-text">สรุปรายวัน</span>
                <span className="ml-2 text-[11px] text-pm-text-3">
                  {fmtDate(data.from)} – {fmtDate(data.to)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-pm-text-3 text-[10px] uppercase tracking-wide border-b border-pm-border bg-pm-bg/50">
                      <th className="px-4 py-2.5 text-left font-medium">วันที่</th>
                      <th className="px-4 py-2.5 text-center font-medium">โครงการ</th>
                      <th className="px-4 py-2.5 text-center font-medium">ผู้ใช้งาน</th>
                      <th className="px-4 py-2.5 text-center font-medium">รายการตรวจ</th>
                      <th className="px-4 py-2.5 pr-4 font-medium text-right hidden sm:table-cell">กราฟ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => {
                      const pct = totalChecks > 0 ? Math.round((row.checkCount / totalChecks) * 100) : 0
                      const hasData = row.checkCount > 0
                      return (
                        <tr key={row.date} className={`border-t border-pm-border ${hasData ? '' : 'opacity-40'}`}>
                          <td className="px-4 py-2.5 text-pm-text-2 whitespace-nowrap">{fmtDay(row.date)}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-pm-text">{row.projectCount}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-pm-text">{row.userCount}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-accent">{row.checkCount}</td>
                          <td className="px-4 py-2.5 pr-4 hidden sm:table-cell">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-24 h-2 bg-pm-bg rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-pm-text-3 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No data */}
          {data.projects.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-[32px] mb-2 opacity-30">📊</div>
              <p className="text-[13px] text-pm-text-3">ไม่มีข้อมูลการใช้งานในช่วงเวลานี้</p>
            </div>
          )}

          {/* Project cards */}
          {data.projects.length > 0 && (
            <>
              <div className="text-[12px] font-medium text-pm-text-2 mb-3">
                โครงการที่มีการใช้งาน ({data.projects.length} โครงการ)
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.projects.map((project) => (
                  <div key={project.projectId} className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-pm-border" style={{ borderLeftColor: project.projectColor, borderLeftWidth: 4 }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-pm-text-3 truncate">{project.projectCode}</div>
                          <div className="text-[14px] font-semibold text-pm-text truncate">{project.projectName}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[22px] font-bold text-accent leading-none">{project.checkCount}</div>
                          <div className="text-[10px] text-pm-text-3">รายการ</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-[11px] font-medium text-pm-text-3 mb-2">
                        ผู้ใช้งาน ({project.users.length} คน)
                      </div>
                      {project.users.length === 0 ? (
                        <p className="text-[11px] text-pm-text-3 italic">ไม่มีข้อมูลผู้ใช้</p>
                      ) : (
                        <div className="space-y-1.5">
                          {project.users.map((user) => (
                            <div key={user.id} className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-pm-bg border border-pm-border flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-medium text-pm-text-2">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="flex-1 text-[12px] text-pm-text truncate min-w-0">{user.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${ROLE_COLORS[user.role] || 'bg-pm-bg text-pm-text-2'}`}>
                                {ROLE_LABELS[user.role] || user.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function AdminUsagePage() {
  return (
    <SuperAdminGuard>
      <UsageContent />
    </SuperAdminGuard>
  )
}
