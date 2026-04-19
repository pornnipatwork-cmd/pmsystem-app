'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { PMScheduleWithItem } from '@/types/pm'
import { getTodayBangkok } from '@/lib/status'

interface Props {
  schedule: PMScheduleWithItem
  onSuccess: () => void
  pdfOnly?: boolean  // ถ้า true = รับเฉพาะ PDF เท่านั้น
}

const MAX_PHOTOS = 3

export function InlineCheckInForm({ schedule, onSuccess, pdfOnly = true }: Props) {
  const today = getTodayBangkok()
  const schedDate = new Date(schedule.scheduledDate)
  schedDate.setHours(0, 0, 0, 0)
  const isPastOrToday = schedDate <= today
  const isOverdue = schedDate < today && !schedule.result

  // OVERDUE และ RESCHEDULED → นัดหมายใหม่อย่างเดียว ไม่อนุญาตบันทึกผลตรวจ
  const isOverdueOrRescheduled = schedule.status === 'OVERDUE' || schedule.status === 'RESCHEDULED'
  const [mode, setMode] = useState<'checkin' | 'reschedule'>(
    isOverdueOrRescheduled ? 'reschedule' : 'checkin'
  )
  const [result, setResult] = useState<'PASS' | 'FAIL' | ''>('')
  const [remark, setRemark] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [attachment, setAttachment] = useState<File | null>(null)
  const [newDate, setNewDate] = useState('')
  const [rescheduleRemark, setRescheduleRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining)
    if (toAdd.length === 0) return

    setCompressing(true)
    try {
      const compressedFiles: File[] = []
      for (const file of toAdd) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,          // ~200KB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg',
        })
        // คงชื่อไฟล์เดิม แต่เปลี่ยน type เป็น jpeg
        compressedFiles.push(new File([compressed], file.name, { type: 'image/jpeg' }))
      }

      setPhotos(prev => [...prev, ...compressedFiles])

      // Generate previews จากไฟล์ที่ compress แล้ว
      compressedFiles.forEach(file => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          setPhotoPreviews(prev => [...prev, ev.target?.result as string])
        }
        reader.readAsDataURL(file)
      })
    } finally {
      setCompressing(false)
    }

    // reset input so same file can be re-added if needed
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCheckin = async () => {
    if (!result) { setError('กรุณาเลือกผลการตรวจ'); return }
    setLoading(true)
    setError('')
    const fd = new FormData()
    fd.append('result', result)
    if (remark) fd.append('remark', remark)
    photos.forEach(p => fd.append('photos', p))
    if (attachment) fd.append('file', attachment)

    const res = await fetch(`/api/pm-schedules/${schedule.id}/checkin`, {
      method: 'PUT',
      body: fd,
    })
    setLoading(false)
    if (res.ok) onSuccess()
    else {
      const data = await res.json()
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  const handleReschedule = async () => {
    if (!newDate) { setError('กรุณาระบุวันนัดหมายใหม่'); return }
    if (!rescheduleRemark.trim()) { setError('กรุณาระบุเหตุผลที่นัดหมายใหม่'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/pm-schedules/${schedule.id}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rescheduledDate: newDate, rescheduledRemark: rescheduleRemark }),
    })
    setLoading(false)
    if (res.ok) onSuccess()
    else {
      const data = await res.json()
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="pt-3">

      {mode === 'checkin' ? (
        <div className="space-y-3">
          {/* Result */}
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 block">ผลการตรวจ *</label>
            <div className="flex gap-2">
              <button
                onClick={() => setResult('PASS')}
                className={`flex-1 py-2 text-[12px] rounded-md border font-medium transition-colors ${result === 'PASS' ? 'bg-green-600 text-white border-green-600' : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'}`}
              >
                ✓ ปกติ
              </button>
              <button
                onClick={() => setResult('FAIL')}
                className={`flex-1 py-2 text-[12px] rounded-md border font-medium transition-colors ${result === 'FAIL' ? 'bg-danger text-white border-danger' : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'}`}
              >
                ✗ ผิดปกติ
              </button>
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 block">หมายเหตุ</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] text-pm-text bg-pm-card outline-none focus:border-accent resize-none"
              placeholder="หมายเหตุ (ถ้ามี)"
            />
          </div>

          {/* Photos — up to 3 */}
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 flex items-center justify-between">
              <span>รูปภาพ (อย่างน้อย 1 รูป แต่สูงสุด {MAX_PHOTOS} รูป)</span>
              <span className="text-pm-text-3">{photos.length}/{MAX_PHOTOS}</span>
            </label>
            {/* Previews */}
            {photoPreviews.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={src}
                      alt={`รูป ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-md border border-pm-border"
                    />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-danger text-white rounded-full text-[10px] leading-none flex items-center justify-center hover:opacity-80"
                      style={{ width: 18, height: 18 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {compressing && (
              <p className="text-[11px] text-accent animate-pulse">⏳ กำลัง compress รูป...</p>
            )}
            {photos.length < MAX_PHOTOS && !compressing && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                  id={`photo-input-${schedule.id}`}
                />
                <label
                  htmlFor={`photo-input-${schedule.id}`}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-pm-border-strong rounded-md text-[12px] text-pm-text-2 cursor-pointer hover:bg-pm-bg transition-colors"
                >
                  <span>📷</span>
                  <span>เพิ่มรูปภาพ</span>
                </label>
              </>
            )}
          </div>

          {/* File attachment — 1 file */}
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 block">ไฟล์แนบ (สูงสุด 1 ไฟล์)</label>
            {attachment ? (
              <div className="flex items-center justify-between px-3 py-2 border border-pm-border rounded-md bg-pm-bg">
                <span className="text-[12px] text-pm-text truncate max-w-[180px]">📎 {attachment.name}</span>
                <button
                  onClick={() => setAttachment(null)}
                  className="text-danger text-[11px] hover:opacity-70 ml-2 shrink-0"
                >
                  ✕ ลบ
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept={pdfOnly ? '.pdf' : '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip'}
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="w-full text-[12px] text-pm-text-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-pm-muted file:text-pm-text-2 file:text-[11px] cursor-pointer"
              />
            )}
            <p className="text-[10px] text-pm-text-3 mt-1">
              {pdfOnly ? 'รองรับ: PDF เท่านั้น' : 'รองรับ: PDF, Word, Excel, TXT, ZIP'}
            </p>
          </div>

          {error && <p className="text-[12px] text-danger">{error}</p>}
          <button
            onClick={handleCheckin}
            disabled={loading || compressing}
            className="w-full py-2 bg-green-600 text-white rounded-md text-[13px] font-medium disabled:opacity-60 hover:bg-green-700 transition-colors"
          >
            {loading ? 'กำลังบันทึก...' : compressing ? 'กำลัง compress รูป...' : 'บันทึกผลการตรวจ'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 block">วันนัดหมายใหม่ *</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={today.toISOString().slice(0, 10)}
              max={new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)}
              className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] text-pm-text bg-pm-card outline-none focus:border-warn"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-pm-text-2 mb-1.5 block">เหตุผล / หมายเหตุ *</label>
            <textarea
              value={rescheduleRemark}
              onChange={(e) => setRescheduleRemark(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-pm-border-strong rounded-md text-[12px] text-pm-text bg-pm-card outline-none focus:border-warn resize-none"
              placeholder="ระบุเหตุผลที่นัดหมายใหม่ (จำเป็น)"
            />
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <button
            onClick={handleReschedule}
            disabled={loading}
            className="w-full py-2 bg-warn text-white rounded-md text-[13px] font-medium disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {loading ? 'กำลังบันทึก...' : 'ยืนยันวันนัดหมายใหม่'}
          </button>
        </div>
      )}
    </div>
  )
}
