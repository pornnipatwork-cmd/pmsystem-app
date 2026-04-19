import PDFDocument from 'pdfkit'
import path from 'path'

const FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf')

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export interface MonthlyReportSection {
  type: string
  category: string
  subCategories: {
    subCategory: string
    totalCount: number
    doneCount: number
    passCount: number
    failCount: number
    pendingCount: number
    engineerComment: string
  }[]
}

export interface MonthlyReportParams {
  projectCode: string
  projectName: string
  month: number
  year: number
  sections: MonthlyReportSection[]
}

function drawHLine(doc: PDFKit.PDFDocument, y: number, x1 = 40, x2 = 555) {
  doc.moveTo(x1, y).lineTo(x2, y).stroke('#CCCCCC')
}

/** Generate PDF in-memory — returns Buffer (ไม่ save ลง disk) */
export async function generateMonthlyReportPDF(params: MonthlyReportParams): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('Thai', FONT_PATH)
    doc.font('Thai')

    const W = 515
    const monthName = THAI_MONTHS[params.month - 1]
    const yearBE = params.year + 543

    let totalAll = 0, totalDone = 0, totalPass = 0, totalFail = 0, totalPending = 0
    for (const sec of params.sections) {
      for (const sub of sec.subCategories) {
        totalAll += sub.totalCount
        totalDone += sub.doneCount
        totalPass += sub.passCount
        totalFail += sub.failCount
        totalPending += sub.pendingCount
      }
    }

    doc.rect(40, 40, W, 70).fill('#1D9E75')
    doc.fillColor('#FFFFFF').fontSize(16).text('รายงาน PM ประจำเดือน', 40, 52, { width: W, align: 'center' })
    doc.fontSize(12).text(`${monthName} ${yearBE}`, 40, 74, { width: W, align: 'center' })
    doc.fillColor('#000000')

    doc.fontSize(11).fillColor('#333333').text(params.projectName, 40, 122, { width: W, align: 'center' })

    const boxY = 142
    doc.rect(40, boxY, W, 52).fill('#F0FDF4').stroke('#BBDDCC')
    doc.fillColor('#000000')

    const cols = [
      { label: 'ทั้งหมด',  value: String(totalAll),      color: '#000000' },
      { label: 'ตรวจแล้ว', value: String(totalDone),    color: '#1D9E75' },
      { label: 'ปกติ',     value: String(totalPass),    color: '#2563EB' },
      { label: 'ผิดปกติ',  value: String(totalFail),    color: '#DC2626' },
      { label: 'รอตรวจ',   value: String(totalPending), color: '#D97706' },
    ]
    const colW = W / cols.length
    cols.forEach((c, i) => {
      const cx = 40 + i * colW
      doc.fontSize(9).fillColor('#555555').text(c.label, cx, boxY + 6, { width: colW, align: 'center' })
      doc.fontSize(18).fillColor(c.color).text(c.value, cx, boxY + 20, { width: colW, align: 'center' })
    })
    doc.fillColor('#000000')

    let y = boxY + 62
    const COL = { sub: 165, total: 55, done: 55, pass: 55, fail: 55, pending: 55, comment: 0 }
    COL.comment = W - COL.sub - COL.total - COL.done - COL.pass - COL.fail - COL.pending

    const drawTableHeader = (yy: number) => {
      doc.rect(40, yy, W, 18).fill('#E5F5EF')
      doc.fontSize(8).fillColor('#555555')
      let x = 40
      doc.text('หมวดย่อย', x + 3, yy + 5, { width: COL.sub - 6 }); x += COL.sub
      doc.text('ทั้งหมด', x, yy + 5, { width: COL.total, align: 'center' }); x += COL.total
      doc.text('ตรวจแล้ว', x, yy + 5, { width: COL.done, align: 'center' }); x += COL.done
      doc.text('ปกติ', x, yy + 5, { width: COL.pass, align: 'center' }); x += COL.pass
      doc.text('ผิดปกติ', x, yy + 5, { width: COL.fail, align: 'center' }); x += COL.fail
      doc.text('รอตรวจ', x, yy + 5, { width: COL.pending, align: 'center' }); x += COL.pending
      doc.text('หมายเหตุวิศวกร', x + 3, yy + 5, { width: COL.comment - 6 })
      doc.fillColor('#000000')
      return yy + 18
    }

    for (const sec of params.sections) {
      if (y > 740) { doc.addPage(); y = 40 }
      const typeLabel = sec.type === 'EE' ? 'EE — ระบบไฟฟ้า' : 'ME — ระบบเครื่องกล'
      doc.rect(40, y, W, 18).fill('#1D9E75')
      doc.fontSize(9).fillColor('#FFFFFF').text(`${typeLabel}  /  ${sec.category}`, 43, y + 5, { width: W - 6 })
      doc.fillColor('#000000')
      y += 18
      y = drawTableHeader(y)

      for (const sub of sec.subCategories) {
        const commentText = sub.failCount > 0 && sub.engineerComment ? sub.engineerComment : '-'
        doc.fontSize(7.5)
        const commentH = doc.heightOfString(commentText, { width: COL.comment - 8 })
        const rowH = Math.max(18, commentH + 8)

        if (y + rowH > 780) { doc.addPage(); y = 40; y = drawTableHeader(y) }

        const rowBg = sub.failCount > 0 ? '#FEF2F2' : '#FFFFFF'
        doc.rect(40, y, W, rowH).fill(rowBg).stroke('#E5E7EB')

        doc.fontSize(8).fillColor('#111111')
        let x = 40
        doc.text(sub.subCategory, x + 3, y + 5, { width: COL.sub - 6, ellipsis: true }); x += COL.sub
        doc.text(String(sub.totalCount), x, y + 5, { width: COL.total, align: 'center' }); x += COL.total
        doc.fillColor('#1D9E75').text(String(sub.doneCount), x, y + 5, { width: COL.done, align: 'center' }); x += COL.done
        doc.fillColor('#2563EB').text(String(sub.passCount), x, y + 5, { width: COL.pass, align: 'center' }); x += COL.pass
        doc.fillColor(sub.failCount > 0 ? '#DC2626' : '#111111').text(String(sub.failCount), x, y + 5, { width: COL.fail, align: 'center' }); x += COL.fail
        doc.fillColor(sub.pendingCount > 0 ? '#D97706' : '#111111').text(String(sub.pendingCount), x, y + 5, { width: COL.pending, align: 'center' }); x += COL.pending
        doc.fillColor('#444444').fontSize(7.5).text(commentText, x + 3, y + 5, { width: COL.comment - 8, lineGap: 1 })

        y += rowH
      }

      y += 8
    }

    const totalPages = doc.bufferedPageRange().count
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i)
      doc.fontSize(7.5).fillColor('#999999')
        .text(`สร้างโดยระบบ PM  •  หน้า ${i + 1}/${totalPages}`, 40, 820, { width: W, align: 'center' })
    }

    doc.end()
  })
}

/** Return suggested filename for the PDF */
export function getPdfFilename(params: Pick<MonthlyReportParams, 'projectCode' | 'month' | 'year'>): string {
  const monthStr = String(params.month).padStart(2, '0')
  return `${params.projectCode}_pm_${params.year}${monthStr}.pdf`
}
