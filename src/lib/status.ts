import type { ScheduleStatus } from '@/types/pm'

/**
 * Calculate PMSchedule status based on dates.
 * This is the single source of truth for status calculation.
 */
export function calculateStatus(params: {
  scheduledDate: Date
  result?: string | null
  rescheduledDate?: Date | null
}): ScheduleStatus {
  const { scheduledDate, result, rescheduledDate } = params

  // RESCHEDULED takes priority over OVERDUE
  if (rescheduledDate) return 'RESCHEDULED'

  // DONE = result recorded
  if (result) return 'DONE'

  // Compare dates using UTC midnight to avoid timezone issues
  const today = getTodayUTC()
  const iso = scheduledDate instanceof Date ? scheduledDate.toISOString() : String(scheduledDate)
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const scheduled = new Date(Date.UTC(y, m - 1, d))

  if (scheduled.getTime() === today.getTime()) return 'TODAY'
  if (scheduled < today) return 'OVERDUE'
  return 'UPCOMING'
}

/**
 * Get today's date as UTC midnight (based on Bangkok date)
 * ใช้วันที่ปัจจุบันของ Bangkok แล้วแปลงเป็น UTC midnight
 */
export function getTodayBangkok(): Date {
  return getTodayUTC()
}

/**
 * Get today's UTC midnight Date based on Bangkok (UTC+7) current date
 */
export function getTodayUTC(): Date {
  const now = new Date()
  // คำนวณวันที่ปัจจุบันในเขต Bangkok (UTC+7)
  const bangkokMs = now.getTime() + (now.getTimezoneOffset() + 7 * 60) * 60000
  const bk = new Date(bangkokMs)
  return new Date(Date.UTC(bk.getFullYear(), bk.getMonth(), bk.getDate()))
}

/**
 * Get current time string HH:MM in Asia/Bangkok timezone
 */
export function getCurrentTimeBangkok(): string {
  const now = new Date()
  const bangkokOffset = 7 * 60
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const bangkokTime = new Date(utc + bangkokOffset * 60000)
  const hh = bangkokTime.getHours().toString().padStart(2, '0')
  const mm = bangkokTime.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Format date as dd/mm/yyyy (Thai display format)
 */
export function formatDateTH(date: Date | string | null): string {
  if (!date) return '-'
  // ใช้ UTC date parts เพื่อหลีกเลี่ยง timezone shift
  const iso = typeof date === 'string' ? date : date.toISOString()
  const [yyyy, mm, dd] = iso.slice(0, 10).split('-').map(Number)
  return `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yyyy}`
}

/**
 * Parse dd/mm/yyyy → Date
 */
export function parseDateTH(str: string): Date | null {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map(Number)
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null
  return new Date(yyyy, mm - 1, dd)
}

/**
 * Format date to Thai month name display
 */
export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const SUB_DIGITS: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄',
  '5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
}

/**
 * แปลงตัวเลขหลังสัญลักษณ์เคมีให้เป็น unicode subscript
 * เช่น "Co2" → "Co₂", "SF6" → "SF₆"
 */
export function fmtChemName(name: string): string {
  return name.replace(/([A-Za-z])(\d+)/g, (_, letter, digits) =>
    letter + digits.split('').map((d: string) => SUB_DIGITS[d] ?? d).join('')
  )
}
