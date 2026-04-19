'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function AdminOverviewContent() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [overdueLoading, setOverdueLoading] = useState(false)
  const [overdueResult, setOverdueResult] = useState<string | null>(null)

  async function handleTriggerOverdue() {
    if (!confirm('อัปเดตสถานะ Overdue ทั้งหมดตอนนี้เลยหรือไม่?')) return
    setOverdueLoading(true)
    setOverdueResult(null)
    try {
      const res = await fetch('/api/admin/trigger-overdue', { method: 'POST' })
      const data = await res.json()
      if (res.ok) setOverdueResult(`✓ อัปเดตแล้ว ${data.updatedCount} รายการ`)
      else setOverdueResult(`✗ ${data.error}`)
    } catch {
      setOverdueResult('✗ เกิดข้อผิดพลาด')
    } finally {
      setOverdueLoading(false)
    }
  }

  const { data: projects } = useSWR('/api/projects', fetcher)

  const allProjects = projects ?? []
  const filtered = selectedProjectId
    ? allProjects.filter((p: any) => p.id === selectedProjectId)
    : allProjects

  const totalProjects = allProjects.length
  const totalUsers = new Set(
    allProjects.flatMap((p: any) => p.users?.map((u: any) => u.userId) ?? [])
  ).size

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pm-text">ภาพรวมทุกโครงการ</h2>
        <p className="text-[12px] text-pm-text-3">สรุปสถานะงาน PM ของทุกโครงการ</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-5">
        <div className="bg-pm-bg rounded-lg p-4 border border-pm-border">
          <div className="text-[11px] text-pm-text-3 mb-1">จำนวนโครงการ</div>
          <div className="text-[28px] font-semibold text-pm-text">{totalProjects}</div>
        </div>
        <div className="bg-pm-bg rounded-lg p-4 border border-pm-border">
          <div className="text-[11px] text-pm-text-3 mb-1">ผู้ใช้งานทั้งหมด</div>
          <div className="text-[28px] font-semibold text-pm-text">{totalUsers}</div>
        </div>
        <div className="bg-accent-light rounded-lg p-4 border border-green-200">
          <div className="text-[11px] text-accent-dark mb-1">ระบบทำงานปกติ</div>
          <div className="text-[28px] font-semibold text-accent">✓</div>
        </div>
      </div>

      {/* Overdue manual trigger */}
      <div className="bg-pm-card rounded-lg border border-pm-border p-4 mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-pm-text">อัปเดตสถานะ Overdue</div>
          <div className="text-[11px] text-pm-text-3 mt-0.5">
            ระบบจะอัปเดตอัตโนมัติทุกวัน 09:00 น. กดปุ่มนี้เพื่อ sync ทันที
          </div>
          {overdueResult && (
            <p className={`mt-1 text-[12px] font-medium ${overdueResult.startsWith('✓') ? 'text-accent' : 'text-danger'}`}>
              {overdueResult}
            </p>
          )}
        </div>
        <button
          onClick={handleTriggerOverdue}
          disabled={overdueLoading}
          className="shrink-0 px-4 py-2 bg-warn text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:opacity-90 transition-opacity"
        >
          {overdueLoading ? 'กำลังอัปเดต...' : 'อัปเดต Overdue'}
        </button>
      </div>

      {/* Project filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[13px] text-pm-text-2">กรองโครงการ:</span>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="px-3 py-1.5 border border-pm-border-strong rounded-md text-[12px] text-pm-text bg-pm-card outline-none focus:border-accent"
        >
          <option value="">ทุกโครงการ</option>
          {allProjects.map((p: any) => (
            <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
          ))}
        </select>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project: any) => {
          const projectUsers = project.users ?? []
          return (
            <div key={project.id} className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
              <div className="p-4 border-b border-pm-border" style={{ borderLeftColor: project.color, borderLeftWidth: 4 }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] text-pm-text-3 mb-0.5">{project.code}</div>
                    <div className="text-[14px] font-semibold text-pm-text">{project.name}</div>
                    <div className="text-[11px] text-pm-text-2 mt-0.5">{project.location}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    project.type === 'HIGHRISE' ? 'bg-info-light text-info border-blue-200'
                    : project.type === 'LOWRISE_AP' ? 'bg-purple-100 text-pm-me border-purple-200'
                    : 'bg-accent-light text-accent-dark border-green-200'
                  }`}>
                    {project.type === 'HIGHRISE' ? 'High Rise' : project.type === 'LOWRISE_AP' ? 'Low Rise AP' : 'Low Rise Non-AP'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="text-[11px] text-pm-text-3 mb-2">ผู้ใช้งาน ({projectUsers.length} คน)</div>
                <div className="flex flex-wrap gap-1">
                  {projectUsers.slice(0, 5).map((up: any) => (
                    <span key={up.userId} className={`text-[10px] px-2 py-0.5 rounded ${ROLE_COLORS[up.user?.role] || 'bg-pm-bg text-pm-text-2'}`}>
                      {up.user?.name}
                    </span>
                  ))}
                  {projectUsers.length > 5 && (
                    <span className="text-[10px] text-pm-text-3">+{projectUsers.length - 5} คน</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-pm-text-3">
                  <span className={`w-2 h-2 rounded-full ${project.lineGroupToken ? 'bg-accent' : 'bg-pm-text-3'}`} />
                  {project.lineGroupToken ? 'Line Notify เปิดใช้งาน' : 'ยังไม่ตั้งค่า Line'}
                  {project.lineGroupToken && ` · ${project.lineNotifyTime} น.`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


export default function AdminOverviewPage() {
  return <AdminOverviewContent />
}
