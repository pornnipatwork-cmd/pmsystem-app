'use client'

import { useState, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useProjectStore } from '@/store/projectStore'
import { useSession } from 'next-auth/react'
import { canEdit } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PendingFile {
  file: File
  month?: number
  year?: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  result?: { items: number; schedules: number; eeItems?: number; meItems?: number }
  warnings?: string[]
}

function extractMonthYear(filename: string): { month: number; year: number } | null {
  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }
  const match = filename.toLowerCase().match(/([a-z]{3})[_\s-](\d{4})/)
  if (match) {
    const month = monthMap[match[1]]
    const year = parseInt(match[2])
    if (month && year) return { month, year }
  }
  return null
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export default function ImportPage() {
  const { currentProjectId } = useProjectStore()
  const { data: session } = useSession()
  const editable = canEdit(session?.user?.role ?? '')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: history, mutate: mutateHistory } = useSWR(
    currentProjectId ? `/api/import/history?projectId=${currentProjectId}` : null,
    fetcher
  )

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = []
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        // แสดง error สำหรับไฟล์ที่ไม่ใช่ Excel
        newFiles.push({
          file,
          status: 'error',
          error: 'รูปแบบไฟล์ไม่ถูกต้อง รับเฉพาะไฟล์ Excel (.xlsx, .xls) เท่านั้น',
        })
        continue
      }
      const my = extractMonthYear(file.name)
      newFiles.push({ file, month: my?.month, year: my?.year, status: 'pending' })
    }
    setPendingFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleImportAll = async () => {
    if (!currentProjectId) return
    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i]
      if (pf.status !== 'pending') continue

      setPendingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f))

      const fd = new FormData()
      fd.append('file', pf.file)
      fd.append('projectId', currentProjectId)

      try {
        const res = await fetch('/api/import', { method: 'POST', body: fd })
        const data = await res.json()
        if (res.ok) {
          setPendingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'success',
              result: { items: data.items, schedules: data.schedules, eeItems: data.eeItems, meItems: data.meItems },
              warnings: data.errors?.length > 0 ? data.errors : undefined,
            } : f
          ))
        } else {
          setPendingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: data.error || 'เกิดข้อผิดพลาด' } : f
          ))
        }
      } catch {
        // fetch ถูก kill (Vercel timeout 60s) — ข้อมูลอาจถูก commit สำเร็จแล้ว
        // รอ 5 วินาที แล้วตรวจสอบ import history ว่าสำเร็จหรือไม่
        await new Promise(resolve => setTimeout(resolve, 5000))
        const freshHistory = await mutateHistory()
        const matched = Array.isArray(freshHistory)
          ? freshHistory.find((h: { fileName: string; status: string; scheduleCount?: number; itemCount?: number }) =>
              h.fileName === pf.file.name && h.status === 'SUCCESS'
            )
          : null
        if (matched) {
          setPendingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'success', result: { items: matched.itemCount ?? 0, schedules: matched.scheduleCount ?? 0 } } : f
          ))
        } else {
          setPendingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: 'เกิดข้อผิดพลาด กรุณาตรวจสอบประวัติการนำเข้า' } : f
          ))
        }
      }
    }
    mutateHistory()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!currentProjectId) {
    return <div className="flex items-center justify-center h-64 text-pm-text-3">กรุณาเลือกโครงการ</div>
  }

  if (!editable) {
    return <div className="flex items-center justify-center h-64 text-pm-text-3">คุณไม่มีสิทธิ์นำเข้าไฟล์</div>
  }

  const hasPending = pendingFiles.some(f => f.status === 'pending')

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[16px] md:text-[17px] font-semibold text-pm-text">นำเข้า Excel</h2>
        <p className="text-[11px] md:text-[12px] text-pm-text-3">นำเข้าแผนงาน PM จากไฟล์ .xlsx หรือ .xls</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 md:p-10 text-center cursor-pointer transition-colors mb-5 ${
          isDragging ? 'border-accent bg-accent-light' : 'border-pm-border-strong hover:border-accent hover:bg-pm-bg'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <svg className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-3 text-pm-text-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
        <p className="text-[13px] md:text-[14px] font-medium text-pm-text mb-1">
          <span className="hidden sm:inline">ลากไฟล์มาวางที่นี่ หรือ</span>
          <span className="sm:hidden">แตะเพื่อ</span>
          <span> คลิกเพื่อเลือก</span>
        </p>
        <p className="text-[11px] md:text-[12px] text-pm-text-3">รองรับ .xlsx และ .xls เท่านั้น</p>
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="bg-pm-card rounded-lg border border-pm-border mb-5">
          <div className="px-4 py-3 border-b border-pm-border flex items-center justify-between">
            <div className="text-[13px] font-medium text-pm-text">ไฟล์รอนำเข้า ({pendingFiles.length})</div>
            {hasPending && (
              <button
                onClick={handleImportAll}
                className="px-4 py-1.5 bg-green-600 text-white text-[12px] font-medium rounded-md hover:bg-green-700 transition-colors"
              >
                นำเข้าทั้งหมด
              </button>
            )}
          </div>
          {pendingFiles.map((pf, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-pm-border last:border-0">
              <div className="w-8 h-8 bg-accent-light rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] md:text-[13px] font-medium text-pm-text truncate">{pf.file.name}</div>
                <div className="text-[11px] text-pm-text-3">
                  {formatFileSize(pf.file.size)}
                  {pf.month && pf.year && ` · ${THAI_MONTHS[pf.month - 1]} ${pf.year}`}
                </div>
                {pf.result && (
                  <div className="text-[11px] text-accent mt-0.5">
                    ✓ {pf.result.items} รายการ
                    {(pf.result.eeItems !== undefined || pf.result.meItems !== undefined) && (
                      <span className="text-pm-text-3"> (EE: {pf.result.eeItems ?? '?'}, ME: {pf.result.meItems ?? '?'})</span>
                    )}
                    {' '}· {pf.result.schedules} ตาราง
                  </div>
                )}
                {pf.warnings && pf.warnings.map((w, wi) => (
                  <div key={wi} className="text-[10px] text-amber-600 mt-0.5">⚠ {w}</div>
                ))}
                {pf.error && <div className="text-[11px] text-danger mt-0.5">✗ {pf.error}</div>}
              </div>
              <div className="flex-shrink-0 text-right">
                {pf.status === 'pending' && <span className="text-[11px] text-pm-text-3">รอ</span>}
                {pf.status === 'uploading' && <span className="text-[11px] text-info animate-pulse">กำลังนำเข้า...</span>}
                {pf.status === 'success' && <span className="text-[11px] text-accent font-medium">✓ สำเร็จ</span>}
                {pf.status === 'error' && <span className="text-[11px] text-danger font-medium">✗ ผิดพลาด</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import history */}
      <div className="bg-pm-card rounded-lg border border-pm-border">
        <div className="px-4 py-3 border-b border-pm-border">
          <div className="text-[13px] font-medium text-pm-text">ประวัติการนำเข้า</div>
        </div>
        {!history || history.length === 0 ? (
          <div className="p-6 text-center text-pm-text-3 text-[13px]">ยังไม่มีประวัติการนำเข้า</div>
        ) : (
          /* Scrollable on mobile */
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[560px]">
              <thead>
                <tr className="bg-pm-bg text-pm-text-3 text-[10px] uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-medium">ชื่อไฟล์</th>
                  <th className="px-4 py-2 text-left font-medium">เดือน/ปี (ข้อมูล PM)</th>
                  <th className="px-4 py-2 text-left font-medium">จำนวนรายการ</th>
                  <th className="px-4 py-2 text-left font-medium">นำเข้าโดย</th>
                  <th className="px-4 py-2 text-left font-medium">วันที่นำเข้า</th>
                  <th className="px-4 py-2 text-left font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id} className="border-t border-pm-border hover:bg-pm-bg">
                    <td className="px-4 py-2.5 text-pm-text max-w-[180px] truncate">{h.fileName}</td>
                    <td className="px-4 py-2.5 text-pm-text-2 whitespace-nowrap">{THAI_MONTHS[h.month - 1]} {h.year}</td>
                    <td className="px-4 py-2.5 text-pm-text-2">{h.scheduleCount ?? '-'} ตาราง</td>
                    <td className="px-4 py-2.5 text-pm-text-2">{h.importedBy?.name}</td>
                    <td className="px-4 py-2.5 text-pm-text-2 whitespace-nowrap">
                      {new Date(h.importedAt).toLocaleDateString('th-TH', {
                        calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                        h.status === 'SUCCESS' ? 'bg-accent-light text-accent-dark border-green-200'
                        : h.status === 'FAILED' ? 'bg-danger-light text-danger border-red-200'
                        : 'bg-pm-bg text-pm-text-2 border-pm-border'
                      }`}>
                        {h.status === 'SUCCESS' ? 'สำเร็จ' : h.status === 'FAILED' ? 'ผิดพลาด' : 'รอดำเนินการ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
