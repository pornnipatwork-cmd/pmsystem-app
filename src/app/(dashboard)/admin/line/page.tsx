'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import SuperAdminGuard from '@/components/layout/SuperAdminGuard'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function MonthlyNotifySettings() {
  const { data: settings, mutate } = useSWR('/api/system-settings', fetcher)
  const [enabled, setEnabled] = useState(false)
  const [day, setDay] = useState(5)
  const [time, setTime] = useState('08:00')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState<string>('')
  const [missingList, setMissingList] = useState<{ project: string; missing: string[] }[]>([])

  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  useEffect(() => {
    if (settings) {
      setEnabled(settings.lineMonthlyEnabled === 'true')
      setDay(parseInt(settings.lineMonthlyDay || '5'))
      setTime(settings.lineMonthlyTime || '08:00')
    }
  }, [settings])

  const handleSave = async () => {
    setLoading(true)
    await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineMonthlyEnabled: String(enabled), lineMonthlyDay: String(day), lineMonthlyTime: time }),
    })
    setLoading(false)
    setEditing(false)
    mutate()
  }

  const handleManualSend = async () => {
    setSendLoading(true)
    setSendResult('')
    setMissingList([])
    const res = await fetch('/api/line-notify/manual-monthly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: prevMonth, year: prevYear }),
    })
    const data = await res.json()
    setSendLoading(false)
    if (res.ok) {
      setSendResult(`✓ ส่งรายงานสรุปสำเร็จ ${data.successCount}/${data.total} โครงการ`)
      setTimeout(() => setSendResult(''), 10000)
    } else {
      setSendResult(`✗ ${data.error || 'เกิดข้อผิดพลาด'}`)
      if (data.missingComments) setMissingList(data.missingComments)
    }
  }

  const currentEnabled = settings?.lineMonthlyEnabled === 'true'
  const currentDay = parseInt(settings?.lineMonthlyDay || '5')

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-pm-text">การแจ้งเตือนประจำเดือน</h3>
          <p className="text-[11px] text-pm-text-3 mt-0.5">ส่งรายงานสรุปประจำเดือนไปยังทุกโครงการที่ตั้งค่า Line ไว้</p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ตั้งค่าวันที่
            </button>
          )}
          <button
            onClick={handleManualSend}
            disabled={sendLoading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-md text-[12px] font-medium hover:bg-purple-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {sendLoading ? 'กำลังส่ง...' : 'ส่งรายงานของเดือนที่แล้ว'}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentEnabled ? 'bg-accent' : 'bg-pm-border-strong'}`} />
            <span className="text-pm-text-2">
              {currentEnabled ? `เปิด — ส่งทุกวันที่ ${currentDay} เวลา ${settings?.lineMonthlyTime || '08:00'} น.` : 'ปิดการแจ้งเตือนอัตโนมัติ'}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-pm-text-2">เปิดการแจ้งเตือนอัตโนมัติ</label>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-pm-border-strong'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          {enabled && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">วันที่ส่งของแต่ละเดือน (1-28)</label>
                <input
                  type="number" min={1} max={28} value={day}
                  onChange={e => setDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-24 px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent"
                />
                <p className="text-[10px] text-pm-text-3 mt-1">ระบบจะส่งอัตโนมัติทุกวันที่ {day} โดยใช้ข้อมูลเดือนก่อนหน้า</p>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">เวลาที่ส่ง (HH:MM)</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-40 px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="px-4 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={loading}
              className="px-4 py-1.5 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {sendResult && (
        <p className={`mt-3 text-[12px] font-medium ${sendResult.startsWith('✓') ? 'text-accent' : 'text-danger'}`}>
          {sendResult}
        </p>
      )}

      {missingList.length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-[11px] font-semibold text-yellow-800 mb-2">Sub-Category ที่ยังไม่มี comment จาก Engineer:</p>
          {missingList.map((m, i) => (
            <div key={i} className="mb-1.5">
              <p className="text-[11px] font-medium text-pm-text">{m.project}</p>
              <ul className="list-disc list-inside pl-1">
                {m.missing.map((item, j) => (
                  <li key={j} className="text-[10px] text-pm-text-2">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OverdueNotifySettings() {
  const { data: settings, mutate } = useSWR('/api/system-settings', fetcher)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('08:00')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState<string>('')

  useEffect(() => {
    if (settings) {
      setEnabled(settings.lineOverdueEnabled === 'true')
      setTime(settings.lineOverdueTime || '08:00')
    }
  }, [settings])

  const handleSave = async () => {
    setLoading(true)
    await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineOverdueEnabled: String(enabled), lineOverdueTime: time }),
    })
    setLoading(false)
    setEditing(false)
    mutate()
  }

  const handleManualSend = async () => {
    setSendLoading(true)
    setSendResult('')
    const res = await fetch('/api/line-notify/manual-overdue', { method: 'POST' })
    const data = await res.json()
    setSendLoading(false)
    if (res.ok) {
      setSendResult(`✓ ส่งสำเร็จ ${data.successCount}/${data.total} โครงการ`)
    } else {
      setSendResult(`✗ ${data.error || 'เกิดข้อผิดพลาด'}`)
    }
    setTimeout(() => setSendResult(''), 8000)
  }

  const currentEnabled = settings?.lineOverdueEnabled === 'true'
  const currentTime = settings?.lineOverdueTime || '08:00'

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-pm-text">แจ้งเตือนงานที่เลยกำหนด</h3>
          <p className="text-[11px] text-pm-text-3 mt-0.5">ส่งรายการงานที่เลยกำหนดไปยังทุกโครงการที่ตั้งค่า Line ไว้</p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ตั้งค่าเวลา
            </button>
          )}
          <button
            onClick={handleManualSend}
            disabled={sendLoading}
            className="px-4 py-1.5 bg-warn text-white rounded-md text-[12px] font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            {sendLoading ? 'กำลังส่ง...' : 'แจ้งเตือนงานที่เลยกำหนด'}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentEnabled ? 'bg-accent' : 'bg-pm-border-strong'}`} />
            <span className="text-pm-text-2">
              {currentEnabled ? `เปิด — ส่งทุกวันเวลา ${currentTime} น.` : 'ปิดการแจ้งเตือนอัตโนมัติ'}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-pm-text-2">เปิดการแจ้งเตือนอัตโนมัติ</label>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-pm-border-strong'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          {enabled && (
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">เวลาที่ส่ง (HH:MM)</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-40 px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
              <p className="text-[10px] text-pm-text-3 mt-1">ระบบจะส่งรายการงานค้างทุกวันตามเวลาที่กำหนด</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="px-4 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={loading}
              className="px-4 py-1.5 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {sendResult && (
        <p className={`mt-3 text-[12px] font-medium ${sendResult.startsWith('✓') ? 'text-accent' : 'text-danger'}`}>
          {sendResult}
        </p>
      )}
    </div>
  )
}

function GlobalNotifySettings() {
  const { data: settings, mutate } = useSWR('/api/system-settings', fetcher)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('09:00')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState<string>('')

  useEffect(() => {
    if (settings) {
      setEnabled(settings.lineNotifyEnabled === 'true')
      setTime(settings.lineNotifyTime || '09:00')
    }
  }, [settings])

  const handleSave = async () => {
    setLoading(true)
    await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineNotifyEnabled: String(enabled), lineNotifyTime: time }),
    })
    setLoading(false)
    setEditing(false)
    mutate()
  }

  const handleManualSend = async () => {
    setSendLoading(true)
    setSendResult('')
    const res = await fetch('/api/line-notify/manual-daily', { method: 'POST' })
    const data = await res.json()
    setSendLoading(false)
    if (res.ok) {
      setSendResult(`✓ ส่งสำเร็จ ${data.successCount}/${data.total} โครงการ`)
    } else {
      setSendResult(`✗ ${data.error || 'เกิดข้อผิดพลาด'}`)
    }
    setTimeout(() => setSendResult(''), 8000)
  }

  const currentTime = settings?.lineNotifyTime
  const currentEnabled = settings?.lineNotifyEnabled === 'true'

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-pm-text">การแจ้งเตือนประจำวัน</h3>
          <p className="text-[11px] text-pm-text-3 mt-0.5">ส่งสรุปรายการตรวจประจำวันไปยังทุกโครงการที่ตั้งค่า Line ไว้</p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ตั้งค่าเวลา
            </button>
          )}
          <button
            onClick={handleManualSend}
            disabled={sendLoading}
            className="px-4 py-1.5 bg-info text-white rounded-md text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            {sendLoading ? 'กำลังส่ง...' : 'ส่งแจ้งเตือนตอนนี้'}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentEnabled ? 'bg-accent' : 'bg-pm-border-strong'}`} />
            <span className="text-pm-text-2">
              {currentEnabled ? `เปิด — ส่งทุกวันเวลา ${currentTime} น.` : 'ปิดการแจ้งเตือนอัตโนมัติ'}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-pm-text-2">เปิดการแจ้งเตือนอัตโนมัติ</label>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-pm-border-strong'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          {enabled && (
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">เวลาที่ส่ง (HH:MM)</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-40 px-3 py-2 border border-pm-border-strong rounded-md text-[13px] outline-none focus:border-accent" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="px-4 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={loading}
              className="px-4 py-1.5 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {sendResult && (
        <p className={`mt-3 text-[12px] font-medium ${sendResult.startsWith('✓') ? 'text-accent' : 'text-danger'}`}>
          {sendResult}
        </p>
      )}
    </div>
  )
}

function ProjectLineCard({ project }: { project: any }) {
  const { data: settings, mutate } = useSWR(`/api/line-settings/${project.id}`, fetcher)
  const [channelToken, setChannelToken] = useState('')
  const [groupId, setGroupId] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  const isConfigured = settings?.lineChannelToken && settings?.lineGroupId

  const startEdit = () => {
    setChannelToken(settings?.lineChannelToken || '')
    setGroupId(settings?.lineGroupId || '')
    setEditing(true)
    setTestMsg('')
  }

  const handleSave = async () => {
    setLoading(true)
    await fetch(`/api/line-settings/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineChannelToken: channelToken, lineGroupId: groupId }),
    })
    setLoading(false)
    setEditing(false)
    mutate()
  }

  const handleTest = async () => {
    setTestMsg('กำลังส่ง...')
    const res = await fetch(`/api/line-notify/test/${project.id}`, { method: 'POST' })
    if (res.ok) {
      setTestMsg('✓ ส่งสำเร็จ! ตรวจสอบใน Line Group')
    } else {
      const data = await res.json().catch(() => ({}))
      setTestMsg(`✗ ${data.error || 'ส่งไม่สำเร็จ'}`)
    }
    setTimeout(() => setTestMsg(''), 6000)
  }

  return (
    <div className="bg-pm-card rounded-lg border border-pm-border overflow-hidden">
      <div className="px-4 py-3 border-b border-pm-border flex items-center gap-3" style={{ borderLeftColor: project.color, borderLeftWidth: 4 }}>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-pm-text">{project.name}</div>
          <div className="text-[11px] text-pm-text-3">{project.code}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${isConfigured ? 'bg-accent-light text-accent-dark border-green-200' : 'bg-pm-bg text-pm-text-3 border-pm-border'}`}>
          {isConfigured ? 'เปิดใช้งาน' : 'ยังไม่ตั้งค่า'}
        </span>
      </div>

      <div className="p-4">
        {!editing ? (
          <div className="space-y-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-pm-text-2">Channel Access Token:</span>
              <span className="text-pm-text font-mono text-[11px]">
                {settings?.lineChannelToken ? `${settings.lineChannelToken.slice(0, 10)}...` : 'ยังไม่ตั้งค่า'}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-pm-text-2">Group ID:</span>
              <span className="text-pm-text font-mono text-[11px]">
                {settings?.lineGroupId || 'ยังไม่ตั้งค่า'}
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={startEdit} className="flex-1 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2 hover:bg-pm-bg">
                แก้ไข
              </button>
              {isConfigured && (
                <button onClick={handleTest} className="flex-1 py-1.5 border border-accent rounded-md text-[12px] text-accent hover:bg-accent-light">
                  ทดสอบ
                </button>
              )}
            </div>
            {testMsg && (
              <p className={`text-[11px] text-center mt-1 ${testMsg.includes('✓') ? 'text-accent' : 'text-danger'}`}>
                {testMsg}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1">Channel Access Token</label>
              <input
                value={channelToken}
                onChange={e => setChannelToken(e.target.value)}
                className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] font-mono outline-none focus:border-accent"
                placeholder="Channel Access Token จาก LINE Developers"
              />
              <p className="text-[10px] text-pm-text-3 mt-1">ดูได้ที่ developers.line.biz → Messaging API → Channel Access Token</p>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1">Group ID</label>
              <input
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] font-mono outline-none focus:border-accent"
                placeholder="C... หรือ G... (Group/Room ID)"
              />
              <p className="text-[10px] text-pm-text-3 mt-1">รับ Group ID โดยเพิ่ม Bot เข้า Group แล้วใช้ Webhook ดู groupId</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 border border-pm-border rounded-md text-[12px] text-pm-text-2">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={loading} className="flex-1 py-1.5 bg-green-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-green-700">
                {loading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminLineContent() {
  const { data: projects } = useSWR('/api/projects', fetcher)

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pm-text">ตั้งค่า Line Messaging API</h2>
        <p className="text-[12px] text-pm-text-3">ตั้งค่า Channel Access Token และ Group ID แยกต่อโครงการ</p>
      </div>

      {/* Global daily notify */}
      <GlobalNotifySettings />

      {/* Overdue notify */}
      <OverdueNotifySettings />

      {/* Monthly report notify */}
      <MonthlyNotifySettings />

      {/* คำแนะนำ */}
      <div className="bg-info-light border border-blue-200 rounded-lg p-4 mb-5 text-[12px] text-info">
        <strong>วิธีตั้งค่า Line Messaging API:</strong>
        <ol className="list-decimal list-inside mt-2 space-y-1.5 text-[11px]">
          <li>ไปที่ <strong>developers.line.biz</strong> → สร้าง Provider และ Messaging API Channel</li>
          <li>ไปที่ <strong>Messaging API → Channel Access Token</strong> → กด &quot;Issue&quot; เพื่อรับ Token</li>
          <li>เพิ่ม Bot เป็น <strong>Admin ใน Line Group</strong> ของโครงการ</li>
          <li>รับ <strong>Group ID</strong> โดยใช้ Webhook หรือ Tool เช่น line-get-group-id
            <br/><span className="text-pm-text-3">Group ID จะขึ้นต้นด้วย C (Group Chat) หรือ R (Room)</span>
          </li>
          <li>กรอก Token และ Group ID ในช่องด้านล่าง แล้วกด &quot;ทดสอบ&quot;</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).map((p: any) => (
          <ProjectLineCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}

export default function AdminLinePage() {
  return <SuperAdminGuard><AdminLineContent /></SuperAdminGuard>
}
