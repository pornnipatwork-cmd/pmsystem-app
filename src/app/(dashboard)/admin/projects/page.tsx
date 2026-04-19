'use client'

import { useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PROJECT_TYPES = [
  { value: 'HIGHRISE', label: 'High Rise' },
  { value: 'LOWRISE_AP', label: 'Low Rise AP' },
  { value: 'LOWRISE_NONAP', label: 'Low Rise Non-AP' },
]

const COLORS = ['#1D9E75', '#185FA5', '#BA7517', '#A32D2D', '#7F77DD', '#378ADD', '#085041']

interface ProjectFormData {
  code: string
  name: string
  type: string
  location: string
  description: string
  lineGroupToken: string
  lineNotifyTime: string
  color: string
}

const emptyForm: ProjectFormData = {
  code: '', name: '', type: 'HIGHRISE', location: '', description: '',
  lineGroupToken: '', lineNotifyTime: '09:00', color: '#1D9E75',
}

const TYPE_FILTERS = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'HIGHRISE', label: 'แนวสูง' },
  { value: 'LOWRISE', label: 'แนวราบ' },
]

function AdminProjectsContent() {
  const { data: projects, mutate } = useSWR('/api/projects', fetcher)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); setError('') }
  const openEdit = (p: any) => {
    setForm({ code: p.code, name: p.name, type: p.type, location: p.location || '', description: p.description || '', lineGroupToken: p.lineGroupToken || '', lineNotifyTime: p.lineNotifyTime, color: p.color })
    setEditingId(p.id); setShowModal(true); setError('')
  }

  const handleSubmit = async () => {
    if (!form.code || !form.name || !form.type) { setError('กรุณากรอกข้อมูลที่จำเป็น'); return }
    setLoading(true); setError('')
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `/api/projects/${editingId}` : '/api/projects'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setLoading(false)
    if (res.ok) { setShowModal(false); mutate() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ยืนยันลบโครงการ "${name}"? ข้อมูล PM Items ทั้งหมดจะถูกลบด้วย`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    mutate()
  }

  const set = (k: keyof ProjectFormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/projects/import', { method: 'POST', body: fd })
    const data = await res.json()
    setImporting(false)
    if (res.ok) { setImportResult(data); mutate() }
    else setImportResult({ added: 0, updated: 0, skipped: 0, errors: [data.error || 'เกิดข้อผิดพลาด'] })
  }

  const filtered = (projects ?? []).filter((p: any) => {
    if (typeFilter === 'ALL') return true
    if (typeFilter === 'HIGHRISE') return p.type === 'HIGHRISE'
    if (typeFilter === 'LOWRISE') return p.type === 'LOWRISE_AP' || p.type === 'LOWRISE_NONAP'
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[17px] font-semibold text-pm-text">จัดการโครงการ</h2>
          <p className="text-[12px] text-pm-text-3">เพิ่ม แก้ไข และลบโครงการ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/projects/export" download className="px-3 py-2 border border-pm-border rounded-md text-[12px] font-medium text-pm-text-2 hover:bg-pm-bg cursor-pointer">
            ↓ Export Excel
          </a>
          <label className={`px-3 py-2 border border-pm-border rounded-md text-[12px] font-medium text-pm-text-2 hover:bg-pm-bg cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            {importing ? 'กำลัง Import...' : '↑ Import Excel'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={openAdd} className="px-3 py-2 bg-green-600 text-white text-[12px] font-medium rounded-md hover:bg-green-700">
            + เพิ่มโครงการ
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
              <th className="px-4 py-3 text-left font-medium">รหัส / ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium">ลักษณะ</th>
              <th className="px-4 py-3 text-left font-medium">สถานที่</th>
              <th className="px-4 py-3 text-left font-medium">Line Notify</th>
              <th className="px-4 py-3 text-left font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t border-pm-border hover:bg-pm-bg">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <div>
                      <div className="font-medium text-pm-text">{p.name}</div>
                      <div className="text-pm-text-3">{p.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-pm-text-2">
                  {p.type === 'HIGHRISE' ? 'High Rise' : p.type === 'LOWRISE_AP' ? 'Low Rise AP' : 'Low Rise Non-AP'}
                </td>
                <td className="px-4 py-3 text-pm-text-2">{p.location || '-'}</td>
                <td className="px-4 py-3">
                  {p.lineGroupToken
                    ? <span className="text-accent text-[11px]">✓ {p.lineNotifyTime} น.</span>
                    : <span className="text-pm-text-3 text-[11px]">ยังไม่ตั้งค่า</span>}
                </td>
                <td className="px-4 py-3 text-pm-text-2">{p.users?.length ?? 0} คน</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(p)} className="text-info hover:underline mr-3">แก้ไข</button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="text-danger hover:underline">ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-pm-card rounded-lg w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
              <h3 className="text-[15px] font-semibold text-pm-text">
                {editingId ? 'แก้ไขโครงการ' : 'เพิ่มโครงการใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-pm-text-3 hover:text-pm-text">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">รหัสโครงการ *</label>
                  <input value={form.code} onChange={e => set('code', e.target.value)} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" placeholder="PROJ-001" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">ชื่อโครงการ *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" placeholder="Life Rama4" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">ลักษณะโครงการ *</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent">
                    {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">สถานที่</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" placeholder="กรุงเทพฯ" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">รายละเอียด</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent resize-none" />
              </div>
              {error && <p className="text-[12px] text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-pm-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
                {loading ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มโครงการ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminProjectsPage() {
  return <AdminProjectsContent />
}
