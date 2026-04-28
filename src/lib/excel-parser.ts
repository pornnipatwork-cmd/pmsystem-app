import * as XLSX from 'xlsx'
import type { PMItemType, PMPeriod } from '@/types/pm'

export interface ParsedPMItem {
  type: PMItemType
  category: string
  subCategory?: string
  no: number
  name: string
  number: string
  location: string
  period: PMPeriod
  scheduleDays: number[] // days of the month with ● mark
}

export interface ParseResult {
  month: number
  year: number
  items: ParsedPMItem[]
  errors: string[]
  eeItems: number
  meItems: number
}

// ตรวจจับสัญลักษณ์ ● และ variants ต่างๆ
const BULLET_CHARS = ['●', '•', '·', '⚫', '◉', '○', '✓', '√', 'x', 'X', '/', 'o']

function isBullet(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false
  // Numeric non-zero = bullet mark (Excel เก็บ ● เป็น number 1 + custom number format)
  // raw: true ทำให้ cell.w ไม่ถูก generate → cell.v คืนค่าตัวเลขดิบ
  if (typeof val === 'number' && val !== 0) return true
  const s = String(val).trim()
  if (s === '') return false
  if (BULLET_CHARS.includes(s)) return true
  if (s.includes('●') || s.includes('•')) return true
  const code = s.codePointAt(0)
  if (code === 0x25CF || code === 0x2022 || code === 0x00B7) return true
  return false
}

function inferPeriod(val: unknown): PMPeriod {
  const v = String(val || '').toLowerCase()
  if (v.includes('daily') || v.includes('รายวัน') || v.includes('ทุกวัน')) return 'DAILY'
  if (v.includes('weekly') || v.includes('รายสัปดาห์') || v.includes('สัปดาห์')) return 'WEEKLY'
  if (v.includes('quarterly') || v.includes('รายไตรมาส') || v.includes('ไตรมาส')) return 'QUARTERLY'
  if (v.includes('yearly') || v.includes('annual') || v.includes('รายปี') || v.includes('ประจำปี')) return 'YEARLY'
  return 'MONTHLY'
}

export async function parseExcelFile(
  buffer: Buffer,
  _projectName?: string
): Promise<ParseResult> {
  const result: ParseResult = {
    month: 0,
    year: 0,
    items: [],
    errors: [],
    eeItems: 0,
    meItems: 0,
  }

  let workbook: XLSX.WorkBook
  try {
    // raw: true = skip cell formatting → เร็วกว่า 3-5x สำหรับไฟล์ .xls ขนาดใหญ่
    // getCellValue() ใช้ cell.w ?? cell.v → ตกไป cell.v โดยอัตโนมัติ ยังทำงานได้ปกติ
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      // ไม่ใช้ raw: true เพราะทำให้ cell.w ไม่ถูก generate
      // Excel บางไฟล์เก็บ ● เป็น numeric value + custom format → ต้องได้ cell.w
      // default options (ไม่มี cellText:true) เร็วกว่าเดิมเพราะไม่ force-format ทุก cell
    })
  } catch (err) {
    result.errors.push(`อ่านไฟล์ไม่ได้: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  // Log ชื่อ sheet ทั้งหมดเพื่อ debug ใน Vercel logs
  console.log(`[parseExcelFile] SheetNames=[${workbook.SheetNames.map(n => `"${n}"`).join(', ')}]`)

  for (const sheetType of ['EE', 'ME'] as const) {
    // ลำดับการค้นหาชื่อ sheet (ปลอดภัย — ไม่จับ sheet ผิด):
    // 1. ตรงทุกอักษร: "EE" / "ME"
    // 2. มี sheetType เป็น "คำ" (word boundary) เช่น "ME Plan", "Sheet EE", "EE/ME"
    //    ใช้ \b ป้องกัน false match เช่น "EMERGENCY" (EM-E ไม่มี boundary ก่อน M)
    //    หรือ "Mechanical" (ME ตามด้วยตัวอักษร ไม่ใช่ word boundary)
    const sheetName =
      workbook.SheetNames.find((n) => n.trim().toUpperCase() === sheetType) ??
      workbook.SheetNames.find((n) => new RegExp(`\\b${sheetType}\\b`, 'i').test(n.trim()))

    if (!sheetName) {
      result.errors.push(`ไม่พบ Sheet "${sheetType}" (มี sheets: ${workbook.SheetNames.join(', ')})`)
      continue
    }

    if (sheetName.trim().toUpperCase() !== sheetType) {
      console.log(`[parseExcelFile] Sheet "${sheetType}" matched as "${sheetName}" (word-boundary match)`)
    }

    const sheet = workbook.Sheets[sheetName]
    const items = parseSheet(sheet, sheetType, result)
    result.items.push(...items)
  }

  // นับ EE/ME items แยกกัน
  result.eeItems = result.items.filter(i => i.type === 'EE').length
  result.meItems = result.items.filter(i => i.type === 'ME').length

  // Log sample numbers ของ ME items เพื่อตรวจ duplicate
  const meItems = result.items.filter(i => i.type === 'ME')
  const meNumbers = meItems.map(i => i.number)
  const meUniqueNumbers = new Set(meNumbers)
  console.log(`[parseExcelFile] total=${result.items.length} EE=${result.eeItems} ME=${result.meItems} errors=${result.errors.length}`)
  console.log(`[parseExcelFile] ME numbers: unique=${meUniqueNumbers.size}/${meNumbers.length} sample=[${meNumbers.slice(0, 5).join(', ')}]`)

  if (result.month === 0) {
    const now = new Date()
    result.month = now.getMonth() + 1
    result.year = now.getFullYear()
  }

  return result
}

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[cellAddr]
  if (!cell) return ''
  const val = cell.w !== undefined ? cell.w : cell.v
  return val !== null && val !== undefined ? String(val).trim() : ''
}

function getCellRawValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[cellAddr]
  if (!cell) return null
  return cell.v !== undefined ? cell.v : (cell.w !== undefined ? cell.w : null)
}

/**
 * ดูว่าแถวถัดไป (ที่มีเนื้อหา) เป็น item row (มีตัวเลขใน NO.) หรือ header row
 * ใช้สำหรับแยก L1 vs L2:
 *   - header ที่ตามด้วย header อีก → L1 (หมวดหมู่หลัก)
 *   - header ที่ตามด้วย items    → L2 (หมวดหมู่ย่อย)
 */
function nextMeaningfulRowIsItem(
  sheet: XLSX.WorkSheet,
  fromRow: number,
  maxRow: number,
  noCol: number,
  nameCol: number
): boolean {
  for (let r = fromRow + 1; r <= maxRow; r++) {
    const noVal = getCellValue(sheet, r, noCol)
    const noRaw = getCellRawValue(sheet, r, noCol)
    const noNum = typeof noRaw === 'number' ? noRaw : parseInt(noVal)

    // มีตัวเลขใน NO. column → item row
    if (!isNaN(noNum) && noNum > 0) return true

    // มีข้อความ (ไม่ใช่ตัวเลข) → header row
    const textAtName = getCellValue(sheet, r, nameCol)
    const textAtNoPlus1 = getCellValue(sheet, r, noCol + 1)
    const textAtNo = noVal && isNaN(parseInt(noVal)) ? noVal : ''
    const hasHeaderContent = textAtName || textAtNoPlus1 || textAtNo

    if (hasHeaderContent) return false
    // แถวว่าง → ข้ามไป
  }
  return true // จบ sheet ถือว่าเป็น item context
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  type: PMItemType,
  result: ParseResult
): ParsedPMItem[] {
  const items: ParsedPMItem[] = []

  const range = sheet['!ref']
  if (!range) {
    result.errors.push(`Sheet ${type}: ว่างเปล่า`)
    return items
  }

  const decoded = XLSX.utils.decode_range(range)
  const maxRow = decoded.e.r
  const maxCol = decoded.e.c

  // หา header row (แถวที่มี No. / No / ลำดับ)
  let headerRowIdx = -1
  let noCol = -1

  for (let r = 0; r <= Math.min(20, maxRow); r++) {
    for (let c = 0; c <= Math.min(15, maxCol); c++) {
      const val = getCellValue(sheet, r, c).toLowerCase()
      if (val === 'no.' || val === 'no' || val === 'ลำดับ' || val === '#') {
        headerRowIdx = r
        noCol = c
        break
      }
    }
    if (headerRowIdx >= 0) break
  }

  if (headerRowIdx < 0) {
    result.errors.push(`Sheet ${type}: ไม่พบ header row (ต้องมีคอลัมน์ "No." หรือ "ลำดับ")`)
    return items
  }

  // อ่าน header row เพื่อหา columns
  let nameCol = -1
  let numberCol = -1
  let locationCol = -1
  let periodCol = -1
  const dateCols: { col: number; day: number }[] = []

  for (let c = 0; c <= maxCol; c++) {
    const rawCell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })]
    if (!rawCell) continue

    const val = getCellValue(sheet, headerRowIdx, c).toLowerCase()
    if (c === noCol) continue

    if (nameCol < 0 && (val.includes('ชื่อ') || val.includes('name') || val === 'equipment' || val.includes('รายการ') || val === 'machine name')) {
      nameCol = c
    } else if (numberCol < 0 && (val.includes('หมายเลข') || val.includes('รหัส') || val.includes('number') || val.includes('code') || val === 'tag no' || val.includes('tag') || val === 'machine number')) {
      numberCol = c
    } else if (locationCol < 0 && (val.includes('ตำแหน่ง') || val.includes('location') || val.includes('สถานที่'))) {
      locationCol = c
    } else if (periodCol < 0 && (val.includes('รอบ') || val.includes('period') || val.includes('freq') || val.includes('ความถี่') || val === 'periodes')) {
      periodCol = c
    }
  }

  // fallback columns
  if (nameCol < 0) nameCol = noCol + 1
  if (numberCol < 0) numberCol = noCol + 2
  if (locationCol < 0) locationCol = noCol + 3
  if (periodCol < 0) periodCol = noCol + 4

  // แปลง raw cell value เป็น day of month (1-31)
  // รองรับ 3 format: plain number (1-31), Excel date serial (>100), string "1"/"01"
  function toDayNum(rawVal: unknown, strVal: string): number {
    if (typeof rawVal === 'number') {
      if (rawVal >= 1 && rawVal <= 31) return rawVal               // plain day number
      if (rawVal > 100) {
        // Excel date serial (e.g. 44928 = April 1 2026)
        // ต้องแปลง: days from Dec 30 1899 → JS UTC date
        const d = new Date(Math.round((rawVal - 25569) * 86400000))
        const day = d.getUTCDate()
        if (day >= 1 && day <= 31) return day
      }
    }
    // string: "1", "01", "1-Apr", "01/04" → parseInt ดึงเลขนำหน้าได้ถูกต้อง
    // ยกเว้น "Apr 1" (ขึ้นต้นด้วยตัวอักษร) → parseInt = NaN
    const s = strVal || String(rawVal ?? '')
    const n = parseInt(s)
    if (!isNaN(n) && n >= 1 && n <= 31 && /^\s*\d/.test(s)) return n
    return -1
  }

  // หาวันที่ (1-31) — ค้นหาในช่วง 6 แถวหลัง header (เผื่อ Excel มี sub-header หลายชั้น)
  let dateRowIdx = headerRowIdx
  const DATE_SEARCH_ROWS = 6
  for (let checkRow = headerRowIdx; checkRow <= Math.min(headerRowIdx + DATE_SEARCH_ROWS, maxRow); checkRow++) {
    const found: { col: number; day: number }[] = []
    for (let c = periodCol + 1; c <= maxCol; c++) {
      const rawCell = sheet[XLSX.utils.encode_cell({ r: checkRow, c })]
      if (!rawCell) continue
      const dayNum = toDayNum(rawCell.v, getCellValue(sheet, checkRow, c))
      if (dayNum >= 1) found.push({ col: c, day: dayNum })
    }
    if (found.length >= 20) {
      dateCols.push(...found)
      dateRowIdx = checkRow
      break
    }
  }

  if (dateCols.length === 0) {
    // Fallback: ค้นหาทุก column (ไม่จำกัด periodCol+1)
    for (let checkRow = headerRowIdx; checkRow <= Math.min(headerRowIdx + DATE_SEARCH_ROWS, maxRow); checkRow++) {
      for (let c = 0; c <= maxCol; c++) {
        const rawCell = sheet[XLSX.utils.encode_cell({ r: checkRow, c })]
        if (!rawCell) continue
        const dayNum = toDayNum(rawCell.v, getCellValue(sheet, checkRow, c))
        if (dayNum >= 1) dateCols.push({ col: c, day: dayNum })
      }
      if (dateCols.length >= 20) { dateRowIdx = checkRow; break }
    }
  }

  // ── Debug: log โครงสร้าง sheet เพื่อดูใน Vercel logs ──────────────────────────
  console.log(`[parseSheet ${type}] headerRow=${headerRowIdx + 1} dateRow=${dateRowIdx + 1} dateCols=${dateCols.length} sampleDays=[${dateCols.slice(0, 5).map(d => d.day).join(',')}] noCol=${noCol} periodCol=${periodCol}`)

  if (dateCols.length === 0) {
    result.errors.push(
      `Sheet ${type}: ไม่พบคอลัมน์วันที่ (1-31) ใน ${DATE_SEARCH_ROWS + 1} แถวหลัง header (row ${headerRowIdx + 1}) — ตาราง PM จะไม่มีวันกำหนด`
    )
  }

  const dataStartRow = dateRowIdx + 1

  let currentCategory = ''
  let currentSubCategory: string | undefined = undefined

  for (let r = dataStartRow; r <= maxRow; r++) {
    const noVal = getCellValue(sheet, r, noCol)
    const noRaw = getCellRawValue(sheet, r, noCol)
    const noNum = typeof noRaw === 'number' ? noRaw : parseInt(noVal)

    if (!noVal || isNaN(noNum)) {
      // ===== แถว Header (ไม่มีตัวเลขใน NO.) =====
      // รวมค่าจากหลาย column เพื่อหาชื่อ header
      const textAtName = getCellValue(sheet, r, nameCol)
      const textAtNoPlus1 = getCellValue(sheet, r, noCol + 1)
      const textAtNo = noVal && isNaN(parseInt(noVal)) ? noVal : ''
      const headerName = textAtName || textAtNoPlus1 || textAtNo

      if (headerName && headerName.length > 0) {
        // ใช้ lookahead แยก L1 vs L2:
        // - ถ้าแถวถัดไปเป็น header อีก → แถวนี้คือ L1 (หมวดหมู่หลัก)
        // - ถ้าแถวถัดไปเป็น item    → แถวนี้คือ L2 (หมวดหมู่ย่อย)
        const nextIsItem = nextMeaningfulRowIsItem(sheet, r, maxRow, noCol, nameCol)

        if (!nextIsItem) {
          // L1: หมวดหมู่หลัก
          currentCategory = headerName
          currentSubCategory = undefined
        } else {
          // แถวถัดไปเป็น item
          if (!currentCategory) {
            // ยังไม่มี category เลย → ตั้งเป็น L1
            currentCategory = headerName
            currentSubCategory = undefined
          } else {
            // มี category แล้ว → ตั้งเป็น L2
            currentSubCategory = headerName
          }
        }
      }
      continue
    }

    // ===== แถว Item (มีตัวเลขใน NO.) =====
    const name = getCellValue(sheet, r, nameCol)
    const number = getCellValue(sheet, r, numberCol)
    const location = getCellValue(sheet, r, locationCol)
    const periodRaw = getCellValue(sheet, r, periodCol)
    const period = inferPeriod(periodRaw || currentCategory)

    if (!name) continue

    // ── Debug: log raw cell ของ 3 date columns แรกสำหรับ item แรก ──────────────
    if (items.length === 0 && dateCols.length > 0) {
      const sampleCells = dateCols.slice(0, 3).map(({ col, day }) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: col })]
        return `day${day}:{v=${JSON.stringify(cell?.v)},w=${JSON.stringify(cell?.w)},t=${cell?.t}}`
      })
      console.log(`[parseSheet ${type}] firstItemRow=${r + 1} sampleCells=${sampleCells.join(' | ')}`)
    }

    // ตรวจสอบวันที่มี ●
    const scheduleDays: number[] = []
    for (const { col, day } of dateCols) {
      const rawCellVal = getCellRawValue(sheet, r, col)
      const textCellVal = getCellValue(sheet, r, col)
      if (isBullet(rawCellVal) || isBullet(textCellVal)) {
        scheduleDays.push(day)
      }
    }

    if (scheduleDays.length === 0 && dateCols.length > 0) {
      // Level 2: ตรวจ cell.h (HTML) และ cell.r (rich text) ด้วย
      for (const { col, day } of dateCols) {
        const cellAddr = XLSX.utils.encode_cell({ r, c: col })
        const cell = sheet[cellAddr]
        if (cell) {
          const allVals = [cell.v, cell.w, cell.h, cell.r]
          for (const v of allVals) {
            if (v && isBullet(v)) {
              scheduleDays.push(day)
              break
            }
          }
        }
      }
    }

    if (scheduleDays.length === 0 && dateCols.length > 0) {
      // ── Level 3: Nuclear fallback ──────────────────────────────────────────
      // ถ้า Level 1 และ 2 ยังได้ 0 → ถือว่า ANY truthy non-zero value = bullet
      // ครอบคลุม Wingdings font และ format แปลกๆ ที่ isBullet() จับไม่ได้
      for (const { col, day } of dateCols) {
        const cellAddr = XLSX.utils.encode_cell({ r, c: col })
        const cell = sheet[cellAddr]
        if (cell) {
          const v = cell.v
          const w = cell.w
          if ((v != null && v !== '' && v !== 0 && v !== false) ||
              (w != null && w !== '' && w !== '0' && w !== 'false')) {
            scheduleDays.push(day)
          }
        }
      }
      // Log เมื่อ nuclear fallback ใช้งานกับ item แรก
      if (scheduleDays.length > 0 && items.length === 0) {
        console.log(`[parseSheet ${type}] nuclear fallback triggered row=${r + 1} scheduleDays=${scheduleDays.length}`)
      }
    }

    items.push({
      type,
      category: currentCategory || 'ทั่วไป',
      subCategory: currentSubCategory,
      no: noNum,
      name,
      number: number || `${type}-${String(noNum).padStart(3, '0')}`,
      location,
      period,
      scheduleDays,
    })
  }

  // ── Debug: เตือนเมื่อ parse ได้ item แต่ไม่มี scheduleDays ─────────────────────
  if (items.length > 0) {
    const withSched = items.filter(i => i.scheduleDays.length > 0).length
    if (withSched === 0) {
      result.errors.push(
        `Sheet ${type}: พบ ${items.length} รายการ แต่ไม่มีเครื่องหมาย ● เลย (dateCols=${dateCols.length}, dateRow=${dateRowIdx + 1}, headerRow=${headerRowIdx + 1}) — ตรวจสอบรูปแบบไฟล์`
      )
    }
  }

  return items
}

/**
 * Extract month and year from Excel filename
 * Format: MMM_YYYY[...].xls หรือ Jan_2025 PM Monthly Plan-โครงการ Life Rama4.xls
 */
export function extractMonthYearFromFilename(filename: string): { month: number; year: number } | null {
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
