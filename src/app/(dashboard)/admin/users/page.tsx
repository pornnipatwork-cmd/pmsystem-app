'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TECHNICIAN', label: 'ช่าง/Technician' },
  { value: 'ENGINEER', label: 'Engineer' },
  { value: 'ASSIST_ADMIN', label: 'Assist Admin' },
  { value: 'BMVM', label: 'BM/VM' },
]

interface UserFormData {
  username: string; password: string; name: string; employeeId: string; role: string; projectIds: string[]
}

const emptyForm: UserFormData = { username: '', password: '', name: '', employeeId: '', role: 'TECHNICIAN', projectIds: [] }

function ProjectSearchInput({ projects, selectedIds, onToggle }: {
  projects: any[], selectedIds: string[], onToggle: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const available = (projects ?? []).filter((p: any) =>
    !selectedIds.includes(p.id) &&
    (`${p.code} ${p.name}`.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="พิมพ์รหัสหรือชื่อโครงการ..."
        className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent"
      />
      {open && available.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-pm-card border border-pm-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {available.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => { onToggle(p.id); setSearch(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] text-pm-text hover:bg-accent-light hover:text-accent-dark transition-colors"
            >
              <span className="font-medium">[{p.code}]</span> {p.name}
            </button>
          ))}
        </div>
      )}
      {open && available.length === 0 && search && (
        <div className="absolute z-10 w-full mt-1 bg-pm-card border border-pm-border rounded-md shadow-lg px-3 py-2 text-[12px] text-pm-text-3">
          ไม่พบโครงการ
        </div>
      )}
    </div>
  )
}

const TYPE_FILTERS = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'HIGHRISE', label: 'แนวสูง' },
  { value: 'LOWRISE', label: 'แนวราบ' },
  { value: 'BOTH', label: 'แนวสูงและแนวราบ' },
]

function AdminUsersContent() {
  const { data: users, mutate } = useSWR('/api/users', fetcher)
  const { data: projects } = useSWR('/api/projects', fetcher)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); setError('') }
  const openEdit = (u: any) => {
    setForm({
      username: u.username, password: '', name: u.name, employeeId: u.employeeId || '', role: u.role,
      projectIds: u.projects?.map((up: any) => up.project.id) ?? [],
    })
    setEditingId(u.id); setShowModal(true); setError('')
  }

  const handleSubmit = async () => {
    if (!form.username || !form.name || !form.role) { setError('กรุณากรอกข้อมูลที่จำเป็น'); return }
    if (!editingId && !form.password) { setError('กรุณากรอกรหัสผ่าน'); return }
    setLoading(true); setError('')
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `/api/users/${editingId}` : '/api/users'
    const body: any = { ...form }
    if (editingId && !form.password) delete body.password
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLoading(false)
    if (res.ok) { setShowModal(false); mutate() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/users/import', { method: 'POST', body: fd })
    const data = await res.json()
    setImporting(false)
    if (res.ok) { setImportResult(data); mutate() }
    else setImportResult({ added: 0, updated: 0, skipped: 0, errors: [data.error || 'เกิดข้อผิดพลาด'] })
  }

  const toggleProject = (pid: string) => {
    setForm(f => ({
      ...f,
      projectIds: f.projectIds.includes(pid) ? f.projectIds.filter(p => p !== pid) : [...f.projectIds, pid],
    }))
  }

  const filteredUsers = (users ?? []).filter((u: any) => {
    if (typeFilter === 'ALL') return true
    const userProjects: any[] = u.projects?.map((up: any) => up.project) ?? []
    const hasHigh = userProjects.some((p: any) => p.type === 'HIGHRISE')
    const hasLow = userProjects.some((p: any) => p.type === 'LOWRISE_AP' || p.type === 'LOWRISE_NONAP')
    if (typeFilter === 'HIGHRISE') return hasHigh && !hasLow
    if (typeFilter === 'LOWRISE') return hasLow && !hasHigh
    if (typeFilter === 'BOTH') return hasHigh && hasLow
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[17px] font-semibold text-pm-text">จัดการผู้ใช้งาน</h2>
          <p className="text-[12px] text-pm-text-3">เพิ่มและแก้ไขข้อมูลผู้ใช้งาน</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/users/export" download className="px-3 py-2 border border-pm-border rounded-md text-[12px] font-medium text-pm-text-2 hover:bg-pm-bg cursor-pointer">
            ↓ Export Excel
          </a>
          <label className={`px-3 py-2 border border-pm-border rounded-md text-[12px] font-medium text-pm-text-2 hover:bg-pm-bg cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            {importing ? 'กำลัง Import...' : '↑ Import Excel'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={openAdd} className="px-3 py-2 bg-green-600 text-white text-[12px] font-medium rounded-md hover:bg-green-700">
            + เพิ่มผู้ใช้งาน
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg border text-[12px] ${importResult.errors.length > 0 && importResult.added + importResult.updated === 0 ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-accent-light border-accent/30 text-accent-dark'}`}>
          <div className="font-medium mb-1">ผลการ Import: เพิ่มใหม่ {importResult.added} รายการ, อัปเดต {importResult.updated} รายการ, ข้าม {importResult.skipped} รายการ</div>
          {importResult.errors.map((e, i) => <div key={i} className="text-danger text-[11px]">• {e}</div>)}
          <button onClick={() => setImportResult(null)} className="mt-1 text-[11px] underline opacity-60">ปิด</button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TYPE_FILTERS.map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${typeFilter === f.value ? 'bg-accent text-white border-accent' : 'bg-pm-card text-pm-text-2 border-pm-border hover:bg-pm-bg'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-pm-card rounded-lg border border-pm-border overflow-hidden overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-pm-bg text-pm-text-3 text-[10px] uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">ชื่อ-สกุล / Username</th>
              <th className="px-4 py-3 text-left font-medium">รหัสพนักงาน</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">โครงการที่ assign</th>
              <th className="px-4 py-3 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u: any) => (
              <tr key={u.id} className="border-t border-pm-border hover:bg-pm-bg">
                <td className="px-4 py-3">
                  <div className="font-medium text-pm-text">{u.name}</div>
                  <div className="text-pm-text-3">@{u.username}</div>
                </td>
                <td className="px-4 py-3 text-pm-text-2">{u.employeeId || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${ROLE_COLORS[u.role] || 'bg-pm-bg text-pm-text-2'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.projects?.map((up: any) => (
                      <span key={up.project.id} className="text-[10px] bg-pm-bg border border-pm-border text-pm-text-2 px-1.5 py-0.5 rounded">
                        {up.project.code}
                      </span>
                    ))}
                    {(!u.projects || u.projects.length === 0) && <span className="text-pm-text-3">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="text-info hover:underline">แก้ไข</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-pm-card rounded-lg w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
              <h3 className="text-[15px] font-semibold text-pm-text">
                {editingId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-pm-text-3 hover:text-pm-text">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">รหัสพนักงาน</label>
                  <input value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" placeholder="EMP-001" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">ชื่อ-สกุล *</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">Username *</label>
                <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">
                    Password {editingId && <span className="text-pm-text-3">(ว่างไว้เพื่อไม่เปลี่ยน)</span>}
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">Role *</label>
                  <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-2">โครงการที่ assign</label>
                {/* Selected project tags */}
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                  {form.projectIds.map((pid: string) => {
                    const p = (projects ?? []).find((p: any) => p.id === pid)
                    if (!p) return null
                    return (
                      <span key={pid} className="inline-flex items-center gap-1 bg-accent-light border border-accent/40 text-accent-dark text-[11px] px-2 py-0.5 rounded-full">
                        {p.code}
                        <button type="button" onClick={() => toggleProject(pid)} className="hover:text-danger leading-none">✕</button>
                      </span>
                    )
                  })}
                  {form.projectIds.length === 0 && <span className="text-[11px] text-pm-text-3">ยังไม่ได้เลือกโครงการ</span>}
                </div>
                <ProjectSearchInput projects={projects ?? []} selectedIds={form.projectIds} onToggle={toggleProject} />
              </div>
              {error && <p className="text-[12px] text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-pm-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
                {loading ? 'กำลังบันทึก...' : editingId ? 'บันทึก' : 'เพิ่มผู้ใช้งาน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return <AdminUsersContent />
}
