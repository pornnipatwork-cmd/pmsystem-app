'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { canComment } from '@/lib/permissions'
import { formatDateTH } from '@/lib/status'

interface Comment {
  id: string
  comment: string
  createdBy: { id: string; name: string; role: string }
  updatedAt: string
}

interface SubCategoryCommentProps {
  projectId: string
  type: string
  category: string
  subCategory: string
  month: number
  year: number
  existingComment?: Comment | null
  onSaved: (comment: Comment) => void
  allDone: boolean
  hasFail?: boolean
}

export function SubCategoryComment({
  projectId, type, category, subCategory,
  month, year, existingComment, onSaved, allDone, hasFail = false,
}: SubCategoryCommentProps) {
  const { data: session } = useSession()
  const userCanComment = canComment(session?.user?.role ?? '')

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(existingComment?.comment ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // แสดงเมื่อ: allDone หรือ มีรายการ FAIL (ต้อง comment) หรือ มี comment อยู่แล้ว
  const shouldShow = allDone || hasFail || !!existingComment
  if (!shouldShow) return null

  // จำเป็นต้อง comment เมื่อมี FAIL และยังไม่มี comment
  const isRequired = hasFail && !existingComment

  const handleSave = async () => {
    if (!text.trim()) { setError('กรุณาระบุ comment'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/subcategory-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, type, category, subCategory, month, year, comment: text }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'เกิดข้อผิดพลาด')
        return
      }
      const saved = await res.json()
      onSaved(saved)
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  // สี border/bg ตาม state
  const containerCls = isRequired
    ? 'border-danger bg-red-50'
    : existingComment
      ? 'border-purple-200 bg-purple-50'
      : 'border-dashed border-purple-300 bg-purple-50/50'

  return (
    <div className={`mx-3 md:mx-4 my-2 rounded-md border ${containerCls}`}>
      {/* Banner เตือนเมื่อต้อง comment */}
      {isRequired && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-danger/30 bg-danger/10">
          <svg className="w-3.5 h-3.5 text-danger flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span className="text-[11px] font-medium text-danger">มีรายการผิดปกติ — Engineer ต้อง comment ก่อน</span>
        </div>
      )}

      {existingComment && !editing ? (
        // แสดง comment ที่มีอยู่
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span className="text-[11px] font-medium text-purple-700">ความคิดเห็น Engineer</span>
                <span className="text-[10px] text-purple-400">
                  · {existingComment.createdBy.name} · {formatDateTH(existingComment.updatedAt)}
                </span>
              </div>
              <p className="text-[12px] text-pm-text whitespace-pre-wrap">{existingComment.comment}</p>
            </div>
            {userCanComment && (
              <button
                onClick={() => { setText(existingComment.comment); setEditing(true) }}
                className="text-[11px] text-purple-500 hover:text-purple-700 flex-shrink-0 px-2 py-1 rounded hover:bg-purple-100"
              >
                แก้ไข
              </button>
            )}
          </div>
        </div>
      ) : userCanComment && (allDone || hasFail) ? (
        // ฟอร์มเพิ่ม/แก้ไข comment
        <div className="p-3">
          {!editing && !existingComment ? (
            <button
              onClick={() => { setText(''); setEditing(true) }}
              className={`w-full flex items-center gap-2 text-[12px] py-1 ${isRequired ? 'text-danger hover:text-red-700' : 'text-purple-500 hover:text-purple-700'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              {isRequired ? 'เพิ่มความคิดเห็น Engineer (จำเป็น)' : 'เพิ่มความคิดเห็น Engineer'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span className="text-[11px] font-medium text-purple-700">ความคิดเห็น Engineer</span>
                {isRequired && <span className="text-[10px] text-danger font-medium">* จำเป็น</span>}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="ระบุความคิดเห็น / ข้อสังเกต / คำแนะนำ..."
                className="w-full px-3 py-2 border border-purple-200 rounded-md text-[12px] outline-none focus:border-purple-400 resize-none bg-white"
              />
              {error && <p className="text-[11px] text-danger">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-[12px] font-medium disabled:opacity-60 hover:bg-purple-700"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button
                  onClick={() => { setEditing(false); setError('') }}
                  className="px-3 py-1.5 border border-pm-border text-pm-text-2 rounded-md text-[12px] hover:bg-pm-bg"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
