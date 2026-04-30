'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminGuard from '@/components/layout/AdminGuard'

interface Project {
  id: string
  code: string
  name: string
}

interface ImportFile {
  id: string
  fileName: string
  month: number
  year: number
  importedAt: string
  importedBy: string
  itemCount: number      // PMItems owned by this file
  scheduleCount: number  // Schedules in this month/year
  status: string
}

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function DataManagementContent() {
  const [projects, setProjects] = useState<Project[]>([])

  // ─── Section 1 state ──────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [importFiles, setImportFiles] = useState<ImportFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  // confirm for single file
  const [confirmFile, setConfirmFile] = useState<ImportFile | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  // confirm for all project files
  const [showProjectConfirm, setShowProjectConfirm] = useState(false)
  const [deleteProjectLoading, setDeleteProjectLoading] = useState(false)
  const [section1Result, setSection1Result] = useState<string>('')

  // ─── Section 2 state ──────────────────────────────────────────────────────
  const [confirmText, setConfirmText] = useState('')
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [deleteAllResult, setDeleteAllResult] = useState<string>('')
  const [showAllConfirm, setShowAllConfirm] = useState(false)

  // ─── Section 3 state ──────────────────────────────────────────────────────
  const [exportProjectId, setExportProjectId] = useState('all')
  const [fromMonth, setFromMonth] = useState(CURRENT_MONTH)
  const [fromYear, setFromYear] = useState(CURRENT_YEAR)
  const [toMonth, setToMonth] = useState(CURRENT_MONTH)
  const [toYear, setToYear] = useState(CURRENT_YEAR)
  const [exportLoading, setExportLoading] = useState(false)

  // ─── Section 4 state ──────────────────────────────────────────────────────
  const [showPhotosConfirm, setShowPhotosConfirm] = useState(false)
  const [deletePhotosLoading, setDeletePhotosLoading] = useState(false)
  const [deletePhotosResult, setDeletePhotosResult] = useState<string>('')

  // Load projects
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
  }, [])

  // Load import files when project selected
  const loadFiles = useCallback(async (projectId: string) => {
    if (!projectId) { setImportFiles([]); return }
    setFilesLoading(true)
    setSection1Result('')
    try {
      const res = await fetch(`/api/data-management/file?projectId=${projectId}`)
      const data = await res.json()
      setImportFiles(Array.isArray(data) ? data : [])
    } catch {
      setImportFiles([])
    }
    setFilesLoading(false)
  }, [])

  useEffect(() => {
    loadFiles(selectedProjectId)
  }, [selectedProjectId, loadFiles])

  // ─── Delete single import file ────────────────────────────────────────────
  const handleDeleteFile = async (file: ImportFile) => {
    setDeletingFileId(file.id)
    setConfirmFile(null)
    setSection1Result('')
    try {
      const res = await fetch('/api/data-management/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importFileId: file.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setSection1Result(`✓ ลบไฟล์ "${file.fileName}" สำเร็จ: ${data.deletedItems} รายการ (${data.deletedSchedules} ตารางงาน)`)
        await loadFiles(selectedProjectId)
      } else {
        setSection1Result(`✗ เกิดข้อผิดพลาด: ${data.error || 'Unknown error'}`)
      }
    } catch {
      setSection1Result('✗ เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
    setDeletingFileId(null)
  }

  // ─── Delete ALL files for selected project ────────────────────────────────
  const handleDeleteProject = async () => {
    if (!selectedProjectId) return
    setDeleteProjectLoading(true)
    setSection1Result('')
    setShowProjectConfirm(false)
    try {
      const res = await fetch('/api/data-management/project', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      })
      const data = await res.json()
      if (res.ok) {
        setSection1Result(`✓ ลบข้อมูลโครงการทั้งหมดสำเร็จ: ${data.deletedItems} รายการ (${data.deletedSchedules} ตารางงาน)`)
        await loadFiles(selectedProjectId)
      } else {
        setSection1Result(`✗ เกิดข้อผิดพลาด: ${data.error || 'Unknown error'}`)
      }
    } catch {
      setSection1Result('✗ เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
    setDeleteProjectLoading(false)
  }

  // ─── Delete ALL ───────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    setDeleteAllResult('')
    setShowAllConfirm(false)
    setConfirmText('')
    try {
      const res = await fetch('/api/data-management/all', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setDeleteAllResult(`✓ ลบสำเร็จทั้งหมด: ${data.deletedItems} รายการ (${data.deletedSchedules} ตารางงาน)`)
        if (selectedProjectId) await loadFiles(selectedProjectId)
      } else {
        setDeleteAllResult(`✗ เกิดข้อผิดพลาด: ${data.error || 'Unknown error'}`)
      }
    } catch {
      setDeleteAllResult('✗ เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
    setDeleteAllLoading(false)
  }

  // ─── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true)
    try {
      const params = new URLSearchParams({
        projectId: exportProjectId,
        fromYear: String(fromYear),
        fromMonth: String(fromMonth),
        toYear: String(toYear),
        toMonth: String(toMonth),
      })
      const res = await fetch(`/api/data-management/export?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`เกิดข้อผิดพลาด: ${data.error || res.statusText}`)
        setExportLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Use filename from Content-Disposition header
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : 'pm_backup.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด')
    }
    setExportLoading(false)
  }

  // ─── Delete photos ────────────────────────────────────────────────────────
  const handleDeletePhotos = async () => {
    setDeletePhotosLoading(true)
    setDeletePhotosResult('')
    setShowPhotosConfirm(false)
    try {
      const res = await fetch('/api/data-management/photos', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setDeletePhotosResult(`✓ ลบรูปภาพสำเร็จ: ${data.deletedFiles} ไฟล์ (อัปเดตตารางงาน ${data.updatedSchedules} รายการ)`)
      } else {
        setDeletePhotosResult(`✗ เกิดข้อผิดพลาด: ${data.error || 'Unknown error'}`)
      }
    } catch {
      setDeletePhotosResult('✗ เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
    setDeletePhotosLoading(false)
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i)
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pm-text">จัดการข้อมูล</h2>
        <p className="text-[12px] text-pm-text-3">ลบข้อมูล Export และจัดการไฟล์รูปภาพ (สำหรับ Super Admin เท่านั้น)</p>
      </div>

      <div className="space-y-5">

        {/* ─── Section 1: Delete per-project / per-file ──────────────────── */}
        <div className="bg-pm-card rounded-lg border border-pm-border p-5">
          <h3 className="text-[14px] font-semibold text-pm-text mb-1">ลบข้อมูล Excel รายโครงการ</h3>
          <p className="text-[11px] text-pm-text-3 mb-1">
            เลือกโครงการเพื่อดูรายการ Excel ที่นำเข้า — ลบทีละไฟล์ หรือลบทั้งหมดพร้อมกัน
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11px] text-pm-text-3">
            <span><span className="font-medium text-pm-text">ตารางตรวจ</span> = นัดตรวจในเดือนนั้น (จากเครื่องหมาย ● ในไฟล์)</span>
          </div>

          {/* Project selector */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <select
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setSection1Result('') }}
              className="flex-1 min-w-[200px] px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-bg outline-none focus:border-accent"
            >
              <option value="">-- เลือกโครงการ --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
            {selectedProjectId && importFiles.length > 0 && (
              <button
                disabled={deleteProjectLoading}
                onClick={() => setShowProjectConfirm(true)}
                className="px-4 py-2 bg-danger text-white rounded-md text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                {deleteProjectLoading ? 'กำลังลบ...' : 'ลบทั้งหมดในโครงการนี้'}
              </button>
            )}
          </div>

          {/* Import files list */}
          {selectedProjectId && (
            <>
              {filesLoading ? (
                <div className="py-6 text-center text-[12px] text-pm-text-3">กำลังโหลดรายการไฟล์...</div>
              ) : importFiles.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-pm-text-3 bg-pm-bg rounded-md border border-pm-border">
                  ไม่มีไฟล์ Excel ที่นำเข้าในโครงการนี้
                </div>
              ) : (
                <div className="rounded-md border border-pm-border overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-pm-bg text-pm-text-3 text-[10px] uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left font-medium">ชื่อไฟล์</th>
                        <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">เดือน/ปี</th>
                        <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">วันที่นำเข้า</th>
                        <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">นำเข้าโดย</th>
                        <th className="px-4 py-2.5 text-center font-medium">ตารางตรวจ</th>
                        <th className="px-4 py-2.5 text-right font-medium">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importFiles.map((f) => (
                        <tr key={f.id} className="border-t border-pm-border hover:bg-pm-bg/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                              <div className="min-w-0">
                                <div className="text-pm-text font-medium truncate max-w-[160px] sm:max-w-[220px]">{f.fileName}</div>
                                <div className="sm:hidden text-[10px] text-pm-text-3 mt-0.5">
                                  {MONTHS[f.month - 1]} {f.year}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-pm-text-2 hidden sm:table-cell whitespace-nowrap">
                            {MONTHS[f.month - 1]} {f.year}
                          </td>
                          <td className="px-4 py-3 text-pm-text-3 hidden md:table-cell whitespace-nowrap">
                            {fmtDate(f.importedAt)}
                          </td>
                          <td className="px-4 py-3 text-pm-text-2 hidden md:table-cell">{f.importedBy}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[12px] font-semibold text-pm-text">{f.scheduleCount.toLocaleString()} รายการ</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setConfirmFile(f)}
                              disabled={deletingFileId === f.id}
                              className="px-3 py-1.5 text-[11px] font-medium text-danger border border-danger/30 rounded-md hover:bg-danger hover:text-white transition-colors disabled:opacity-40"
                            >
                              {deletingFileId === f.id ? 'ลบ...' : 'ลบไฟล์นี้'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {section1Result && (
            <p className={`mt-3 text-[12px] font-medium ${section1Result.startsWith('✓') ? 'text-green-600' : 'text-danger'}`}>
              {section1Result}
            </p>
          )}
        </div>

        {/* ─── Section 2: Delete all ─────────────────────────────────────── */}
        <div className="bg-pm-card rounded-lg border border-danger/30 p-5">
          <h3 className="text-[14px] font-semibold text-pm-text mb-1">ลบข้อมูล Excel ทั้งหมด</h3>
          <p className="text-[11px] text-pm-text-3 mb-4">
            ลบ PM Items และตารางงานทั้งหมดที่นำเข้าจาก Excel ในทุกโครงการ — ไม่สามารถกู้คืนได้
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-pm-text-2">พิมพ์ "ยืนยัน" เพื่อเปิดใช้ปุ่มลบ</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ยืนยัน"
                className="px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-bg outline-none focus:border-danger w-40"
              />
            </div>
            <button
              disabled={confirmText !== 'ยืนยัน' || deleteAllLoading}
              onClick={() => setShowAllConfirm(true)}
              className="px-4 py-2 bg-danger text-white rounded-md text-[13px] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {deleteAllLoading ? 'กำลังลบ...' : 'ลบข้อมูลทั้งหมด'}
            </button>
          </div>
          {deleteAllResult && (
            <p className={`mt-3 text-[12px] font-medium ${deleteAllResult.startsWith('✓') ? 'text-green-600' : 'text-danger'}`}>
              {deleteAllResult}
            </p>
          )}
        </div>

        {/* ─── Section 3: Export backup ─────────────────────────────────── */}
        <div className="bg-pm-card rounded-lg border border-pm-border p-5">
          <h3 className="text-[14px] font-semibold text-pm-text mb-1">Export Backup (ผลการตรวจ + รูปภาพ)</h3>
          <p className="text-[11px] text-pm-text-3 mb-4">
            ดาวน์โหลดข้อมูลผลการตรวจ PM พร้อมรูปภาพและไฟล์แนบจริง เป็น ZIP — ภายในมีไฟล์ Excel, โฟลเดอร์ <code className="bg-pm-bg px-1 rounded">photos/</code> และ <code className="bg-pm-bg px-1 rounded">attachments/</code> ชื่อไฟล์จะใช้ชื่อเครื่องตามด้วยวันที่ เช่น <code className="bg-pm-bg px-1 rounded">ชื่อเครื่อง_20260416.jpg</code>
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1">โครงการ</label>
              <select
                value={exportProjectId}
                onChange={(e) => setExportProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-pm-border rounded-md text-[13px] text-pm-text bg-pm-bg outline-none focus:border-accent"
              >
                <option value="all">ทุกโครงการ</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1">ตั้งแต่เดือน</label>
              <div className="flex gap-1">
                <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}
                  className="flex-1 px-2 py-2 border border-pm-border rounded-md text-[12px] text-pm-text bg-pm-bg outline-none focus:border-accent">
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}
                  className="w-20 px-2 py-2 border border-pm-border rounded-md text-[12px] text-pm-text bg-pm-bg outline-none focus:border-accent">
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-pm-text-2 mb-1">ถึงเดือน</label>
              <div className="flex gap-1">
                <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}
                  className="flex-1 px-2 py-2 border border-pm-border rounded-md text-[12px] text-pm-text bg-pm-bg outline-none focus:border-accent">
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}
                  className="w-20 px-2 py-2 border border-pm-border rounded-md text-[12px] text-pm-text bg-pm-bg outline-none focus:border-accent">
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={handleExport} disabled={exportLoading}
                className="w-full px-4 py-2 bg-info text-white rounded-md text-[13px] font-medium disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {exportLoading ? 'กำลังสร้าง ZIP...' : 'ดาวน์โหลด Backup (ZIP)'}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Section 4: Delete photos ─────────────────────────────────── */}
        <div className="bg-pm-card rounded-lg border border-pm-border p-5">
          <h3 className="text-[14px] font-semibold text-pm-text mb-1">ลบรูปภาพทั้งหมด</h3>
          <p className="text-[11px] text-pm-text-3 mb-4">
            ล้างข้อมูล URL รูปภาพทั้งหมดออกจากระบบ (รูปบน ImgBB ยังคงอยู่)
          </p>
          <button onClick={() => setShowPhotosConfirm(true)} disabled={deletePhotosLoading}
            className="px-4 py-2 bg-danger text-white rounded-md text-[13px] font-medium disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {deletePhotosLoading ? 'กำลังลบ...' : 'ลบรูปภาพทั้งหมด'}
          </button>
          {deletePhotosResult && (
            <p className={`mt-3 text-[12px] font-medium ${deletePhotosResult.startsWith('✓') ? 'text-green-600' : 'text-danger'}`}>
              {deletePhotosResult}
            </p>
          )}
        </div>
      </div>

      {/* ─── Confirm: Delete single file ──────────────────────────────────── */}
      {confirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-pm-card rounded-xl border border-pm-border shadow-xl p-6 max-w-sm w-full">
            <h4 className="text-[15px] font-semibold text-pm-text mb-2">ยืนยันการลบไฟล์</h4>
            <div className="flex items-center gap-2 bg-pm-bg rounded-md px-3 py-2 mb-3">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span className="text-[13px] font-medium text-pm-text truncate">{confirmFile.fileName}</span>
            </div>
            <div className="bg-pm-bg rounded-md p-3 mb-4 space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-pm-text-3">เดือน</span>
                <span className="font-medium text-pm-text">{MONTHS[confirmFile.month - 1]} {confirmFile.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pm-text-3">ตารางตรวจในเดือนนี้</span>
                <span className="font-medium text-pm-text">{confirmFile.scheduleCount.toLocaleString()} รายการ</span>
              </div>
            </div>
            <p className="text-[11px] text-pm-text-3 mb-5">
              ตารางตรวจในเดือนนี้จะถูกลบถาวร — ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmFile(null)}
                className="flex-1 py-2 border border-pm-border rounded-md text-[13px] text-pm-text-2 hover:bg-pm-bg">
                ยกเลิก
              </button>
              <button onClick={() => handleDeleteFile(confirmFile)}
                className="flex-1 py-2 bg-danger text-white rounded-md text-[13px] font-medium hover:opacity-90">
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm: Delete all project files ────────────────────────────── */}
      {showProjectConfirm && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-pm-card rounded-xl border border-pm-border shadow-xl p-6 max-w-sm w-full">
            <h4 className="text-[15px] font-semibold text-pm-text mb-2">ลบข้อมูลทั้งหมดในโครงการ</h4>
            <p className="text-[13px] text-pm-text-2 mb-1">ลบ Excel ทั้ง <strong>{importFiles.length} ไฟล์</strong> ของโครงการ:</p>
            <p className="text-[14px] font-semibold text-danger mb-4">
              [{selectedProject.code}] {selectedProject.name}
            </p>
            <p className="text-[11px] text-pm-text-3 mb-5">
              PM Items และตารางงานทั้งหมดจะถูกลบถาวร — ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowProjectConfirm(false)}
                className="flex-1 py-2 border border-pm-border rounded-md text-[13px] text-pm-text-2 hover:bg-pm-bg">
                ยกเลิก
              </button>
              <button onClick={handleDeleteProject}
                className="flex-1 py-2 bg-danger text-white rounded-md text-[13px] font-medium hover:opacity-90">
                ยืนยันลบทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm: Delete ALL ──────────────────────────────────────────── */}
      {showAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-pm-card rounded-xl border border-pm-border shadow-xl p-6 max-w-sm w-full">
            <h4 className="text-[15px] font-semibold text-danger mb-2">ยืนยันการลบข้อมูลทั้งหมด</h4>
            <p className="text-[13px] text-pm-text-2 mb-4">
              ลบ PM Items และตารางงานที่นำเข้าจาก Excel ทั้งหมด{' '}
              <span className="font-semibold text-danger">ทุกโครงการ</span> — ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowAllConfirm(false); setConfirmText('') }}
                className="flex-1 py-2 border border-pm-border rounded-md text-[13px] text-pm-text-2 hover:bg-pm-bg">
                ยกเลิก
              </button>
              <button onClick={handleDeleteAll}
                className="flex-1 py-2 bg-danger text-white rounded-md text-[13px] font-medium hover:opacity-90">
                ยืนยันลบทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm: Delete photos ───────────────────────────────────────── */}
      {showPhotosConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-pm-card rounded-xl border border-pm-border shadow-xl p-6 max-w-sm w-full">
            <h4 className="text-[15px] font-semibold text-danger mb-2">ยืนยันการลบรูปภาพ</h4>
            <p className="text-[13px] text-pm-text-2 mb-4">
              ลบรูปภาพทั้งหมดในโฟลเดอร์{' '}
              <code className="bg-pm-bg px-1 rounded">uploads/</code>{' '}
              และล้างข้อมูล URL ในฐานข้อมูล — ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowPhotosConfirm(false)}
                className="flex-1 py-2 border border-pm-border rounded-md text-[13px] text-pm-text-2 hover:bg-pm-bg">
                ยกเลิก
              </button>
              <button onClick={handleDeletePhotos}
                className="flex-1 py-2 bg-danger text-white rounded-md text-[13px] font-medium hover:opacity-90">
                ยืนยันลบรูปภาพ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDataPage() {
  return (
    <AdminGuard>
      <DataManagementContent />
    </AdminGuard>
  )
}
