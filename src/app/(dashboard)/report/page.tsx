'use client'

import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useProjectStore } from '@/store/projectStore'
import { PMScheduleWithItem } from '@/types/pm'
import { getTodayBangkok, THAI_MONTHS, THAI_MONTHS_SHORT, fmtChemName } from '@/lib/status'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/* ── Period abbreviation ── */
const PLAN_ABBR: Record<string, string> = {
  DAILY: 'D', WEEKLY: 'W', MONTHLY: 'M', QUARTERLY: 'Q', YEARLY: 'A',
}
const PLAN_NOTE: Record<string, string> = {
  M: 'Monthly (1 Month)',
  Q: 'Quarterly (3 Month)',
  S: 'Semi - annual (6 Month)',
  A: 'Annually (1 Year)',
}

/* ── Individual item row ── */
interface ItemRow {
  id: string
  no: number
  name: string
  number: string
  location: string
  plan: string
  isDone: boolean
  isPass: boolean
  isFail: boolean
  remark: string
  isRescheduled: boolean
  isOverdue: boolean
}

interface SubSection {
  subCategory: string   // empty string = no sub-category header
  items: ItemRow[]
  comment: string       // engineer comment for this sub-category
}

interface CategoryGroup {
  category: string
  subSections: SubSection[]
}

interface SectionData {
  type: string       // 'EE' | 'ME'
  sectionNo: number  // 1 = EE, 2 = ME
  categories: CategoryGroup[]
}

export default function ReportPage() {
  const { currentProjectId, currentProject } = useProjectStore()
  const { data: session } = useSession()
  const today = getTodayBangkok()
  const reportRef = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)
  const [reportType, setReportType] = useState<'detail' | 'summary'>('detail')

  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear]   = useState(today.getFullYear())
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EE' | 'ME'>('ALL')

  const printReport = () => {
    const el = reportRef.current
    if (!el) return
    setPrinting(true)

    const css = `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: white;
             font-family: 'Sarabun', 'TH SarabunNew', Arial, sans-serif; color: #111; }
      .no-print { display: none !important; }

      @page { size: A4 portrait; margin: 20mm 12mm 15mm 12mm; }

      /* สำคัญ: table-header-group ทำให้ Chrome บังคับ table ขึ้นหน้าใหม่
         เปลี่ยนเป็น table-row-group ให้ content ไหลต่อเนื่องจากหน้า 1 */
      thead { display: table-row-group !important; }
      table { page-break-inside: auto; }
      tr    { page-break-inside: avoid; page-break-after: auto; }
      .sec-row { page-break-after: avoid !important; }

      .rpt-table { border-collapse: collapse; width: 100%; font-size: 7.5pt; }
      .rpt-table th, .rpt-table td { border: 0.5pt solid #555; padding: 2pt 3pt; }

      .hd-main  { background: #FFB800 !important; color: #111 !important;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hd-sub   { background: #FFD966 !important;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hd-green { background: #e2efda !important;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hd-red   { background: #fce4d6 !important;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sec-row  { background: #FFF4CC !important;
                  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `

    // สร้าง iframe ซ่อน — ไม่เปิด tab ใหม่
    const iframe = document.createElement('iframe')
    // ใช้ opacity:0 (ไม่ใช่ visibility:hidden เพราะจะบล็อก focus/print)
    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:794px;height:297mm;' +
      'border:none;opacity:0;pointer-events:none;z-index:-1;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument!
    doc.open()
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8">` +
      `<style>${css}</style></head><body>${el.innerHTML}</body></html>`
    )
    doc.close()

    // รอ render แล้ว print
    setTimeout(() => {
      try {
        iframe.contentWindow!.focus()
        iframe.contentWindow!.print()
      } finally {
        // ลบ iframe หลัง dialog ปิด (afterprint)
        const cleanup = () => {
          document.body.removeChild(iframe)
          setPrinting(false)
        }
        iframe.contentWindow!.addEventListener('afterprint', cleanup, { once: true })
        // fallback กัน afterprint ไม่ fire
        setTimeout(cleanup, 30_000)
      }
    }, 600)
  }

  const { data: raw, isLoading } = useSWR<PMScheduleWithItem[]>(
    currentProjectId
      ? `/api/pm-schedules?projectId=${currentProjectId}&month=${month}&year=${year}`
      : null,
    fetcher
  )

  const { data: commentsRaw } = useSWR(
    currentProjectId
      ? `/api/subcategory-comments?projectId=${currentProjectId}&month=${month}&year=${year}`
      : null,
    fetcher
  )

  // ดึง users ของโครงการ เพื่อหา Engineer
  const { data: projectUsersRaw } = useSWR(
    currentProjectId ? `/api/projects/${currentProjectId}/users` : null,
    fetcher
  )
  const engineerUsers: { name: string; role: string }[] = useMemo(() => {
    const arr = Array.isArray(projectUsersRaw) ? projectUsersRaw : []
    return arr.filter((u: { role: string }) => u.role === 'ENGINEER')
  }, [projectUsersRaw])
  const engineerName = engineerUsers.length > 0
    ? engineerUsers.map(u => u.name).join(' / ')
    : '____________________'

  // lookup: "type__category__subCategory" → comment string
  const commentMap = useMemo(() => {
    const map: Record<string, string> = {}
    const arr = Array.isArray(commentsRaw) ? commentsRaw : []
    for (const c of arr) {
      if (c.comment?.trim()) {
        map[`${c.type}__${c.category}__${c.subCategory}`] = c.comment.trim()
      }
    }
    return map
  }, [commentsRaw])

  const list = Array.isArray(raw) ? raw : []

  /* ── Build sections (grouped by type → category → subCategory) ── */
  const sections = useMemo((): SectionData[] => {
    const filtered = typeFilter === 'ALL' ? list : list.filter(s => s.pmItem.type === typeFilter)

    // Level 1: type → Level 2: category → Level 3: subCategory
    const typeMap: Record<string, Record<string, Record<string, PMScheduleWithItem[]>>> = {}
    for (const s of filtered) {
      const t  = s.pmItem.type
      const c  = s.pmItem.category
      const sk = s.pmItem.subCategory || ''
      if (!typeMap[t])       typeMap[t]    = {}
      if (!typeMap[t][c])    typeMap[t][c] = {}
      if (!typeMap[t][c][sk]) typeMap[t][c][sk] = []
      typeMap[t][c][sk].push(s)
    }

    // EE first, then ME
    const typeOrder = ['EE', 'ME']
    const typeKeys  = [...typeOrder.filter(t => typeMap[t]), ...Object.keys(typeMap).filter(t => !typeOrder.includes(t))]

    return typeKeys.map((type, idx) => {
      const catMap = typeMap[type]
      const categories: CategoryGroup[] = Object.entries(catMap).map(([category, subMap]) => {
        const subSections: SubSection[] = Object.entries(subMap).map(([sub, schedules]) => {
          const sorted = [...schedules].sort((a, b) => (a.pmItem.no ?? 0) - (b.pmItem.no ?? 0))
          const items: ItemRow[] = sorted.map(s => {
            const isDone = s.status === 'DONE'
            const remarks: string[] = []
            if (s.remark?.trim()) remarks.push(s.remark.trim())
            if (s.rescheduledRemark?.trim()) remarks.push(`[นัดใหม่] ${s.rescheduledRemark.trim()}`)
            return {
              id: s.id, no: s.pmItem.no ?? 0, name: s.pmItem.name,
              number: s.pmItem.number ?? '', location: s.pmItem.location ?? '',
              plan: PLAN_ABBR[s.pmItem.period] ?? 'M', isDone,
              isPass: isDone && s.result === 'PASS',
              isFail: isDone && s.result === 'FAIL',
              remark: remarks.join(' / '),
              isRescheduled: s.status === 'RESCHEDULED',
              isOverdue: s.status === 'OVERDUE',
            }
          })
          const comment = commentMap[`${type}__${category}__${sub}`] ?? ''
          return { subCategory: sub, items, comment }
        })
        return { category, subSections }
      })
      return { type, sectionNo: idx + 1, categories }
    })
  }, [list, typeFilter, commentMap])

  const totalItems = sections.reduce((acc, s) => acc + s.categories.reduce((a2, c) => a2 + c.subSections.reduce((a3, ss) => a3 + ss.items.length, 0), 0), 0)
  const totalDone  = sections.reduce((acc, s) => acc + s.categories.reduce((a2, c) => a2 + c.subSections.reduce((a3, ss) => a3 + ss.items.filter(i => i.isDone).length, 0), 0), 0)

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`
  const dateLabel  = `${new Date(Date.UTC(year, month, 0)).getDate()} ${THAI_MONTHS_SHORT[month - 1]}. ${year}`

  if (!currentProjectId) {
    return <div className="flex items-center justify-center h-64 text-pm-text-3">กรุณาเลือกโครงการ</div>
  }

  /* ── column widths (%) ── */
  const W = { no: '5%', item: '22%', plan: '5%', normal: '6%', abnormal: '7%', remark: '30%', comment: '25%' }

  return (
    <>
      {/* Print CSS — ใช้ iframe print แล้ว ไม่ต้องการ @media print ที่นี่ */}

      {/* ── Screen Controls ── */}
      <div className="no-print mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[17px] font-semibold text-pm-text">
              {reportType === 'detail'
                ? 'รายงานรายละเอียดการบำรุงรักษาเชิงป้องกันประจำเดือน'
                : 'รายงานสรุปผลการบำรุงรักษาเชิงป้องกันประจำเดือน'}
            </h2>
            <p className="text-[12px] text-pm-text-3">
              {reportType === 'detail'
                ? 'Monthly Preventive Maintenance Detail Report'
                : 'Monthly Preventive Maintenance Summary Report'}
            </p>
          </div>
          <button
            onClick={printReport}
            disabled={printing || sections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-[13px] font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            พิมพ์ / บันทึก PDF
          </button>
        </div>

        {/* Report type tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setReportType('detail')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${reportType === 'detail' ? 'bg-pm-text text-white border-pm-text' : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'}`}
          >
            รายงานรายละเอียด
          </button>
          <button
            onClick={() => setReportType('summary')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${reportType === 'summary' ? 'bg-pm-text text-white border-pm-text' : 'border-pm-border text-pm-text-2 hover:bg-pm-bg'}`}
          >
            รายงานสรุป
          </button>
        </div>

        <div className="bg-pm-card rounded-lg border border-pm-border p-3 flex flex-wrap gap-3 items-center mb-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 border border-pm-border rounded hover:bg-pm-bg">
              <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span className="text-[14px] font-semibold text-pm-text min-w-[120px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1.5 border border-pm-border rounded hover:bg-pm-bg">
              <svg className="w-4 h-4 text-pm-text-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {!isLoading && (
            <div className="flex gap-2 ml-auto text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-pm-bg border border-pm-border text-pm-text">รวม {totalItems} รายการ</span>
              <span className="px-2.5 py-1 rounded-full bg-green-100 border border-green-200 text-green-700">ตรวจแล้ว {totalDone}</span>
              <span className="px-2.5 py-1 rounded-full bg-info-light border border-blue-200 text-info">รอตรวจ {totalItems - totalDone}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── PRINTABLE AREA ── */}
      <div id="rpt" ref={reportRef} className="bg-white overflow-x-auto">
        {isLoading ? (
          <div className="no-print text-center py-16 text-pm-text-3">กำลังโหลด...</div>
        ) : sections.length === 0 ? (
          <div className="no-print bg-pm-card rounded-lg border border-pm-border p-12 text-center text-pm-text-3">ไม่พบข้อมูลสำหรับเดือนที่เลือก</div>
        ) : reportType === 'summary' ? (
          /* ══════════════════════════════════════════════
             SUMMARY REPORT
          ══════════════════════════════════════════════ */
          <div style={{ fontFamily: 'Sarabun, TH SarabunNew, Arial, sans-serif', color: '#111', padding: '20px 24px' }}>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', lineHeight: 1.4 }}>
                รายงานสรุปผลการบำรุงรักษาเชิงป้องกันประจำเดือน
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>Monthly Preventive Maintenance Summary Report</div>
            </div>

            {/* Header Meta */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '80%', paddingRight: '8px' }}>
                    <b>PROJECT :</b> {currentProject?.name?.toUpperCase() ?? '—'}
                  </td>
                  <td style={{ width: '20%', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <b>วันที่ (DATE)</b> {dateLabel}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ paddingTop: '2px' }}>
                    <b>MACHINE-EQUIPMENT :</b>{' '}
                    {typeFilter === 'ALL' ? 'ELECTRICAL & MECHANICAL' : typeFilter === 'EE' ? 'ELECTRICAL & COMMUNICATION' : 'MECHANICAL'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Summary Table */}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: '6%', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    ลำดับ<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>No.</span>
                  </th>
                  <th rowSpan={2} style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'center', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    รายการบำรุงรักษา<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Maintenance Items</span>
                  </th>
                  <th rowSpan={2} style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: '6%', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    Plan
                  </th>
                  <th colSpan={2} style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    ผลการบำรุงรักษา<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Maintenance Result</span>
                  </th>
                  <th rowSpan={2} style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: '28%', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    หมายเหตุ<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Remarks</span>
                  </th>
                </tr>
                <tr>
                  <th style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: '7%', backgroundColor: '#e2efda', fontSize: '10px' }}>
                    ปกติ<br/><span style={{ fontSize: '8px', fontWeight: 'normal' }}>Normal</span>
                  </th>
                  <th style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: '8%', backgroundColor: '#fce4d6', fontSize: '10px' }}>
                    ผิดปกติ<br/><span style={{ fontSize: '8px', fontWeight: 'normal' }}>Ab-Normal</span>
                  </th>
                </tr>
              </thead>

              {sections.map((sec) => {
                let subNo = 0
                return (
                  <tbody key={sec.type}>
                    {/* Type header */}
                    <tr style={{ backgroundColor: '#FFB800' }}>
                      <td colSpan={6} style={{ border: '0.5px solid #555', padding: '3px 8px', fontWeight: 'bold', fontSize: '11px', color: '#111' }}>
                        {sec.sectionNo}. {sec.type === 'EE' ? 'ELECTRICAL' : sec.type === 'ME' ? 'MECHANICAL' : sec.type}
                      </td>
                    </tr>

                    {sec.categories.flatMap((cat) =>
                      cat.subSections.map((ss) => {
                        subNo++
                        const passCount    = ss.items.filter(i => i.isPass).length
                        const failCount    = ss.items.filter(i => i.isFail).length
                        const doneCount    = passCount + failCount
                        const pendingCount = ss.items.length - doneCount
                        const hasFail      = failCount > 0
                        const plan         = ss.items[0]?.plan ?? 'M'
                        const label        = ss.subCategory || cat.category
                        const remarks      = doneCount > 0
                          ? `ผ่าน ${passCount} / ไม่ผ่าน ${failCount}${pendingCount > 0 ? ` (รอตรวจ ${pendingCount})` : ''}`
                          : pendingCount > 0 ? `รอตรวจ ${pendingCount}` : ''

                        return (
                          <tr key={`sum-${sec.type}-${cat.category}-${ss.subCategory}`}
                            style={{ backgroundColor: hasFail ? '#fff8f8' : doneCount > 0 ? '#f9fdf6' : 'white' }}>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', fontSize: '10px', color: '#555' }}>
                              {sec.sectionNo}.{subNo}
                            </td>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 6px', fontSize: '10px', fontWeight: 500 }}>
                              {label}
                            </td>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                              {plan}
                            </td>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', backgroundColor: '#f9fdf6' }}>
                              {!hasFail && doneCount > 0 && <span style={{ color: '#166534', fontWeight: 'bold', fontSize: '14px' }}>✓</span>}
                            </td>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', backgroundColor: '#fffaf9' }}>
                              {hasFail && <span style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '14px' }}>✓</span>}
                            </td>
                            <td style={{ border: '0.5px solid #ccc', padding: '2px 6px', fontSize: '9px', color: hasFail ? '#991b1b' : '#444' }}>
                              {remarks}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                )
              })}
            </table>

            {/* Engineer Comments Section */}
            {(() => {
              const withComments = sections.flatMap((sec) => {
                let subNo = 0
                return sec.categories.flatMap((cat) =>
                  cat.subSections
                    .map((ss) => { subNo++; return { sec, cat, ss, subNo } })
                    .filter(({ ss }) => ss.comment.trim())
                )
              })
              if (withComments.length === 0) return null
              return (
                <div style={{ marginTop: '14px', fontSize: '10px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #999', paddingBottom: '2px' }}>
                    ความเห็นวิศวกร (Engineer Comments)
                  </div>
                  {withComments.map(({ sec, cat, ss, subNo }) => (
                    <div key={`ec-${sec.type}-${cat.category}-${ss.subCategory}`} style={{ marginBottom: '6px' }}>
                      <div style={{ fontWeight: '600', color: '#333' }}>
                        {sec.sectionNo}.{subNo} {ss.subCategory || cat.category}
                      </div>
                      <div style={{ color: '#444', paddingLeft: '12px', whiteSpace: 'pre-line' }}>{ss.comment}</div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', fontSize: '10px', color: '#333' }}>
              <div style={{ lineHeight: 1.7 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Note :</div>
                {Object.entries(PLAN_NOTE).map(([k, v]) => (
                  <div key={k}>{k} : {v}</div>
                ))}
              </div>
              <div style={{ textAlign: 'center', minWidth: '160px' }}>
                <div style={{ borderBottom: '1px dashed #888', marginBottom: '4px', paddingTop: '36px', width: '160px' }}></div>
                <div>(____________________)</div>
                <div>ตำแหน่ง : Tech Sup. / Tech.</div>
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>ผู้ให้ข้อมูล</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ borderBottom: '1px dashed #888', marginBottom: '4px', paddingTop: '36px', width: '200px' }}></div>
                <div>( {engineerName} )</div>
                <div>ตำแหน่ง : Officer: Engineering and Field Inspection</div>
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>วิศวกรส่วนกลาง</div>
              </div>
            </div>

          </div>
        ) : (
          /* ══════════════════════════════════════════════
             DETAIL REPORT (existing)
          ══════════════════════════════════════════════ */
          <div style={{ fontFamily: 'Sarabun, TH SarabunNew, Arial, sans-serif', color: '#111', padding: '20px 24px' }}>

            {/* ── Report Title ── */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', lineHeight: 1.4 }}>
                รายงานรายละเอียดการบำรุงรักษาเชิงป้องกันประจำเดือน
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>Monthly Preventive Maintenance Detail Report</div>
            </div>

            {/* ── Header Meta ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '80%', paddingRight: '8px' }}>
                    <b>PROJECT :</b> {currentProject?.name?.toUpperCase() ?? '—'}
                  </td>
                  <td style={{ width: '20%', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <b>วันที่ (DATE)</b> {dateLabel}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ paddingTop: '2px' }}>
                    <b>MACHINE-EQUIPMENT :</b>{' '}
                    {typeFilter === 'ALL' ? 'ELECTRICAL & MECHANICAL'
                      : typeFilter === 'EE' ? 'ELECTRICAL & COMMUNICATION'
                      : 'MECHANICAL'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Main Table ── */}
            <table className="rpt-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th rowSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.no, backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    ลำดับ<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>No.</span>
                  </th>
                  <th rowSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'center', width: W.item, backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    รายการบำรุงรักษา<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Maintenance Items</span>
                  </th>
                  <th rowSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.plan, backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    Plan
                  </th>
                  <th colSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    ผลการบำรุงรักษา<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Maintenance Result</span>
                  </th>
                  <th rowSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.remark, backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    หมายเหตุ<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Remarks</span>
                  </th>
                  <th rowSpan={2} className="hd-main" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.comment, backgroundColor: '#FFB800', color: '#111', fontWeight: 'bold' }}>
                    ความเห็นวิศวกรรม<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Engineer Comments</span>
                  </th>
                </tr>
                <tr>
                  <th className="hd-green" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.normal, backgroundColor: '#e2efda', fontSize: '10px' }}>
                    ปกติ<br/><span style={{ fontSize: '8px', fontWeight: 'normal' }}>Normal</span>
                  </th>
                  <th className="hd-red" style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', width: W.abnormal, backgroundColor: '#fce4d6', fontSize: '10px' }}>
                    ผิดปกติ<br/><span style={{ fontSize: '8px', fontWeight: 'normal' }}>Ab-Normal</span>
                  </th>
                </tr>
              </thead>

              {/* ── Sections (grouped by Type) ── */}
              {sections.map((sec) => (
                <tbody key={sec.type}>
                  {/* ══ Level 1: Type header (EE / ME) ══ */}
                  <tr className="sec-row" style={{ backgroundColor: '#FFB800' }}>
                    <td colSpan={7} style={{ border: '0.5px solid #555', padding: '3px 8px', fontWeight: 'bold', fontSize: '11px', color: '#111' }}>
                      {sec.sectionNo}. {sec.type === 'EE' ? 'ELECTRICAL' : sec.type === 'ME' ? 'MECHANICAL' : sec.type}
                    </td>
                  </tr>

                  {sec.categories.map((cat) => (
                    <>
                      {/* ══ Level 2: Category header ══ */}
                      <tr key={`cathdr-${sec.type}-${cat.category}`} style={{ backgroundColor: '#FFF4CC' }}>
                        <td colSpan={7} style={{ border: '0.5px solid #888', padding: '2px 14px', fontWeight: 'bold', fontSize: '10px', color: '#444' }}>
                          <span style={{
                            display: 'inline-block', fontSize: '9px', padding: '1px 4px', borderRadius: '2px', marginRight: '5px',
                            backgroundColor: sec.type === 'EE' ? '#dbeafe' : '#ede9fe',
                            color: sec.type === 'EE' ? '#1e40af' : '#5b21b6',
                          }}>{sec.type}</span>
                          {cat.category}
                        </td>
                      </tr>

                      {cat.subSections.map((ss) => (
                        <>
                          {/* ══ Level 3: Sub-category header ══ */}
                          {ss.subCategory && (
                            <tr key={`subhdr-${sec.type}-${cat.category}-${ss.subCategory}`} style={{ backgroundColor: '#FFFDE7' }}>
                              <td colSpan={6} style={{ border: '0.5px solid #999', padding: '2px 20px', fontSize: '10px', fontWeight: '600', color: '#555' }}>
                                ▸ {ss.subCategory}
                              </td>
                              <td style={{ border: '0.5px solid #555', padding: '4px 6px', fontSize: '9px', color: '#333', verticalAlign: 'top', whiteSpace: 'pre-line' }}>
                                {ss.comment}
                              </td>
                            </tr>
                          )}

                          {/* ══ Level 4: Items ══ */}
                          {ss.items.map((item, itemIdx) => (
                            <tr key={item.id} style={{ backgroundColor: item.isDone ? '#f9fdf6' : item.isOverdue ? '#fff8f8' : 'white' }}>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>
                                {item.no}
                              </td>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 6px', fontSize: '10px' }}>
                                <div style={{ fontWeight: 500 }}>{fmtChemName(item.name)}</div>
                                {item.number && <div style={{ fontSize: '9px', color: '#777' }}>{item.number}</div>}
                                {item.location && <div style={{ fontSize: '9px', color: '#888' }}>📍 {item.location}</div>}
                              </td>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                                {item.plan}
                              </td>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', backgroundColor: '#f9fdf6' }}>
                                {item.isPass && <span style={{ color: '#166534', fontWeight: 'bold', fontSize: '14px' }}>✓</span>}
                              </td>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 4px', textAlign: 'center', backgroundColor: '#fffaf9' }}>
                                {item.isFail && <span style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '14px' }}>✓</span>}
                              </td>
                              <td style={{ border: '0.5px solid #ccc', padding: '2px 6px', fontSize: '9px', color: item.isFail ? '#991b1b' : item.isRescheduled ? '#d97706' : '#444' }}>
                                {item.remark}
                                {item.isOverdue && !item.remark && <span style={{ color: '#dc2626', fontStyle: 'italic' }}>เกินกำหนด</span>}
                              </td>
                              {!ss.subCategory ? (
                                itemIdx === 0
                                  ? <td style={{ border: '0.5px solid #555', padding: '4px 6px', fontSize: '9px', color: '#333', verticalAlign: 'top', whiteSpace: 'pre-line' }}>{ss.comment}</td>
                                  : <td style={{ border: '0.5px solid #ccc' }}></td>
                              ) : (
                                <td style={{ border: '0.5px solid #ccc' }}></td>
                              )}
                            </tr>
                          ))}
                        </>
                      ))}
                    </>
                  ))}
                </tbody>
              ))}
            </table>

            {/* ── Signatures ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', fontSize: '10px', color: '#333' }}>
              {/* Note */}
              <div style={{ lineHeight: 1.7 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Note :</div>
                {Object.entries(PLAN_NOTE).map(([k, v]) => (
                  <div key={k}>{k} : {v}</div>
                ))}
              </div>
              {/* Sig Left */}
              <div style={{ textAlign: 'center', minWidth: '160px' }}>
                <div style={{ borderBottom: '1px dashed #888', marginBottom: '4px', paddingTop: '36px', width: '160px' }}></div>
                <div>(____________________)</div>
                <div>ตำแหน่ง : Tech Sup. / Tech.</div>
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>ผู้ให้ข้อมูล</div>
              </div>
              {/* Sig Right */}
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ borderBottom: '1px dashed #888', marginBottom: '4px', paddingTop: '36px', width: '200px' }}></div>
                <div>( {engineerName} )</div>
                <div>ตำแหน่ง : Officer: Engineering and Field Inspection</div>
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>วิศวกรส่วนกลาง</div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  )
}
