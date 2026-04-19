'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import useSWR from 'swr'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface EditForm {
  name: string
  employeeId: string
}

export default function TeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { data: users, mutate } = useSWR('/api/users', fetcher)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({ name: '', employeeId: '' })
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ENGINEER') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading' || !session || session.user.role !== 'ENGINEER') return null

  const openEdit = (u: any) => {
    setForm({ name: u.name, employeeId: u.employeeId || '' })
    setEditingId(u.id)
    setShowModal(true)
    setError('')
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('กรุณากรอกชื่อ-สกุล'); return }
    setLoading(true); setError('')
    const res = await fetch(`/api/users/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, employeeId: form.employeeId }),
    })
    setLoading(false)
    if (res.ok) { setShowModal(false); mutate() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pm-text">จัดการผู้ใช้งาน</h2>
        <p className="text-[12px] text-pm-text-3">สมาชิกในโครงการของคุณ (ยกเว้น Engineer)</p>
      </div>

      <div className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
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
            {(users ?? []).map((u: any) => (
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
            {(users ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-pm-text-3">ไม่พบสมาชิกในโครงการ</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-pm-card rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
              <h3 className="text-[15px] font-semibold text-pm-text">แก้ไขข้อมูลผู้ใช้งาน</h3>
              <button onClick={() => setShowModal(false)} className="text-pm-text-3 hover:text-pm-text">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">ชื่อ-สกุล *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">รหัสพนักงาน</label>
                <input value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" placeholder="EMP-001" />
              </div>
              {error && <p className="text-[12px] text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-pm-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
                {loading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
