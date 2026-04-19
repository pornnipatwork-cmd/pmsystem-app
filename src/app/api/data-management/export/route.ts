import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import path from 'path'

function safeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80)
}

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// Fetch image from URL (ImgBB or any public URL); return null if failed
async function tryFetchFile(url: string): Promise<Buffer | null> {
  // Legacy local path — ไม่มีไฟล์บน Vercel แล้ว
  if (url.startsWith('/uploads/')) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || 'all'
  const fromYear = parseInt(searchParams.get('fromYear') || String(new Date().getFullYear()))
  const fromMonth = parseInt(searchParams.get('fromMonth') || '1')
  const toYear = parseInt(searchParams.get('toYear') || String(new Date().getFullYear()))
  const toMonth = parseInt(searchParams.get('toMonth') || String(new Date().getMonth() + 1))

  const fromDate = new Date(Date.UTC(fromYear, fromMonth - 1, 1))
  const toDate = new Date(Date.UTC(toYear, toMonth, 1))

  const schedules = await prisma.pMSchedule.findMany({
    where: {
      scheduledDate: { gte: fromDate, lt: toDate },
      status: 'DONE',
      ...(projectId !== 'all' ? { pmItem: { projectId } } : {}),
    },
    include: {
      pmItem: {
        select: {
          name: true,
          number: true,
          type: true,
          category: true,
          subCategory: true,
          project: { select: { name: true, code: true } },
        },
      },
      checkedBy: { select: { name: true } },
    },
    orderBy: [{ pmItem: { projectId: 'asc' } }, { scheduledDate: 'asc' }],
  })

  const zip = new JSZip()
  const photosFolder = zip.folder('photos')!

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Backup')

  sheet.columns = [
    { header: 'โครงการ',          key: 'projectName',   width: 25 },
    { header: 'ประเภท',           key: 'type',           width: 8  },
    { header: 'หมวด',             key: 'category',       width: 20 },
    { header: 'หมวดย่อย',         key: 'subCategory',    width: 25 },
    { header: 'ชื่อเครื่อง',      key: 'machineName',    width: 30 },
    { header: 'หมายเลขเครื่อง',   key: 'machineNo',      width: 18 },
    { header: 'วันที่กำหนด',      key: 'scheduledDate',  width: 15 },
    { header: 'ผลการตรวจ',        key: 'result',         width: 12 },
    { header: 'หมายเหตุ',         key: 'remark',         width: 30 },
    { header: 'วันที่ตรวจ',       key: 'checkedAt',      width: 18 },
    { header: 'ผู้ตรวจ',          key: 'checkedByName',  width: 20 },
    { header: 'รูปภาพ (ใน ZIP)',   key: 'photoFiles',     width: 55 },
  ]

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    }
  })

  for (const s of schedules) {
    const dateStr = toDateStr(new Date(s.scheduledDate))
    const baseName = safeFileName(s.pmItem.name)

    const photoEntries: string[] = []
    if (s.photoUrl) {
      let urlArr: string[] = []
      try {
        const parsed = JSON.parse(s.photoUrl)
        urlArr = Array.isArray(parsed) ? parsed : [String(s.photoUrl)]
      } catch {
        urlArr = [String(s.photoUrl)]
      }

      for (let i = 0; i < urlArr.length; i++) {
        const url = urlArr[i]
        const origExt = path.extname(url) || '.jpg'
        const suffix = urlArr.length > 1 ? `_${i + 1}` : ''
        const newName = `${baseName}_${dateStr}${suffix}${origExt}`

        const buf = await tryFetchFile(url)
        if (buf) {
          photosFolder.file(newName, new Uint8Array(buf))
          photoEntries.push(`photos/${newName}`)
        } else {
          photoEntries.push(`photos/${newName} (ดึงไม่ได้)`)
        }
      }
    }

    sheet.addRow({
      projectName:   s.pmItem.project.name,
      type:          s.pmItem.type,
      category:      s.pmItem.category,
      subCategory:   s.pmItem.subCategory || '',
      machineName:   s.pmItem.name,
      machineNo:     s.pmItem.number,
      scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString('th-TH') : '',
      result:        s.result || '',
      remark:        s.remark || '',
      checkedAt:     s.checkedAt ? new Date(s.checkedAt).toLocaleString('th-TH') : '',
      checkedByName: s.checkedBy?.name || '',
      photoFiles:    photoEntries.join(' | '),
    })
  }

  const excelBuffer = await workbook.xlsx.writeBuffer()
  zip.file('inspection_results.xlsx', excelBuffer)

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  let projectCode = 'all'
  if (projectId !== 'all') {
    const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } })
    projectCode = proj ? safeFileName(proj.code) : projectId.slice(0, 8)
  }
  const fromPart = `${fromYear}${String(fromMonth).padStart(2, '0')}`
  const toPart   = `${toYear}${String(toMonth).padStart(2, '0')}`
  const zipName  = `${projectCode}_pm_${fromPart}_${toPart}.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    },
  })
}
