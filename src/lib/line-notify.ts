import { formatDateTH } from './status'

const LINE_MESSAGING_API_URL = 'https://api.line.me/v2/bot/message/push'

async function sendLineMessage(
  channelToken: string,
  groupId: string,
  messages: object[]
): Promise<boolean> {
  if (!channelToken || !groupId) return false
  try {
    const res = await fetch(LINE_MESSAGING_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: groupId, messages }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[LineMessaging] API error:', res.status, err)
    }
    return res.ok
  } catch (error) {
    console.error('[LineMessaging] Failed to send:', error)
    return false
  }
}

export async function sendCheckInNotify(
  channelToken: string,
  groupId: string,
  params: {
    machineName: string
    result: 'PASS' | 'FAIL'
    photoPublicUrl?: string | null  // ImgBB public URL
    checkedByName: string
    checkedAt: Date
  }
): Promise<boolean> {
  const timeStr = params.checkedAt.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
  const resultTH = params.result === 'PASS' ? 'ปกติ ✅' : 'ผิดปกติ ❌'

  const textMessage = {
    type: 'text',
    text: [
      '[PM Check-in]',
      `เครื่องจักร: ${params.machineName}`,
      `ผลการตรวจ: ${resultTH}`,
      `ผู้บันทึก: ${params.checkedByName}`,
      `เวลา: ${timeStr} น.`,
    ].join('\n'),
  }

  const messages: object[] = [textMessage]

  // ถ้ามีรูปภาพ public URL → ส่งเป็น image message
  if (params.photoPublicUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: params.photoPublicUrl,
      previewImageUrl: params.photoPublicUrl,
    })
  }

  return sendLineMessage(channelToken, groupId, messages)
}

export async function sendRescheduleNotify(
  channelToken: string,
  groupId: string,
  params: {
    machineName: string
    newDate: Date
    remark: string
    rescheduledByName: string
  }
): Promise<boolean> {
  const message = [
    '[PM Reschedule]',
    `เครื่องจักร: ${params.machineName}`,
    `วันนัดหมายใหม่: ${formatDateTH(params.newDate)}`,
    `หมายเหตุ: ${params.remark || '-'}`,
    `ผู้บันทึก: ${params.rescheduledByName}`,
  ].join('\n')

  return sendLineMessage(channelToken, groupId, [{ type: 'text', text: message }])
}

export async function sendDailySummaryNotify(
  channelToken: string,
  groupId: string,
  params: {
    projectName: string
    todayItems: { machineName: string; type: string }[]
    overdueCount: number
    date: Date
  }
): Promise<boolean> {
  const dateStr = formatDateTH(params.date)
  const itemLines = params.todayItems
    .slice(0, 10)
    .map((item, i) => `  ${i + 1}. [${item.type}] ${item.machineName}`)
    .join('\n')

  const moreCount = params.todayItems.length - 10
  const moreLine = moreCount > 0 ? `\n  ... และอีก ${moreCount} รายการ` : ''
  const overdueNote = params.overdueCount > 0 ? `\n⚠️ งานค้าง: ${params.overdueCount} รายการ` : ''

  const message = [
    `📋 [PM Daily Summary]`,
    `โครงการ: ${params.projectName}`,
    `วันที่: ${dateStr}`,
    ``,
    `งานวันนี้ (${params.todayItems.length} รายการ):`,
    itemLines || '  ไม่มีงานวันนี้',
    moreLine,
    overdueNote,
  ]
    .filter((l) => l !== undefined)
    .join('\n')

  return sendLineMessage(channelToken, groupId, [{ type: 'text', text: message }])
}

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

export async function sendMonthlySummaryNotify(
  channelToken: string,
  groupId: string,
  params: {
    projectName: string
    month: number
    year: number
    sections: {
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
    }[]
  }
): Promise<boolean> {
  const monthName = THAI_MONTHS[params.month - 1]
  const yearBE = params.year + 543

  const lines: string[] = [
    `📊 [PM Monthly Report]`,
    `โครงการ: ${params.projectName}`,
    `รายงานประจำเดือน: ${monthName} ${yearBE}`,
    ``,
  ]

  // Total stats
  let totalDone = 0, totalAll = 0, totalFail = 0
  for (const sec of params.sections) {
    for (const sub of sec.subCategories) {
      totalAll += sub.totalCount
      totalDone += sub.doneCount
      totalFail += sub.failCount
    }
  }
  lines.push(`สรุป: ตรวจแล้ว ${totalDone}/${totalAll} | ผิดปกติ ${totalFail} รายการ`)
  lines.push(``)

  // Per section
  for (const sec of params.sections) {
    const typeLabel = sec.type === 'EE' ? '⚡ EE ระบบไฟฟ้า' : '🔧 ME ระบบเครื่องกล'
    lines.push(`${typeLabel} — ${sec.category}`)
    for (const sub of sec.subCategories) {
      const status = sub.failCount > 0 ? '❌' : '✅'
      lines.push(`${status} ${sub.subCategory}: ปกติ ${sub.passCount} / ผิดปกติ ${sub.failCount} / รอ ${sub.pendingCount}`)
      if (sub.failCount > 0 && sub.engineerComment) {
        lines.push(`  💬 ${sub.engineerComment}`)
      }
    }
    lines.push(``)
  }

  const message = lines.join('\n').trimEnd()
  return sendLineMessage(channelToken, groupId, [{ type: 'text', text: message }])
}

const THAI_MONTHS_NOTIFY = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

/** Send monthly report as flex message with PDF download button */
export async function sendMonthlyReportPDF(
  channelToken: string,
  groupId: string,
  params: {
    projectName: string
    month: number
    year: number
    totalAll: number
    totalDone: number
    totalPass: number
    totalFail: number
    totalPending: number
    pdfUrl: string
  }
): Promise<boolean> {
  const monthName = THAI_MONTHS_NOTIFY[params.month - 1]
  const yearBE = params.year + 543
  const doneRate = params.totalAll > 0 ? Math.round((params.totalDone / params.totalAll) * 100) : 0
  const statusColor = params.totalFail > 0 ? '#DC2626' : '#1D9E75'
  const statusText  = params.totalFail > 0 ? `⚠️ ผิดปกติ ${params.totalFail} รายการ` : '✅ ปกติทั้งหมด'

  const flexMessage = {
    type: 'flex',
    altText: `📊 PM Monthly Report — ${params.projectName} ${monthName} ${yearBE}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1D9E75',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: '📊 PM Monthly Report', color: '#FFFFFF', size: 'sm', weight: 'bold' },
          { type: 'text', text: `${params.projectName}`, color: '#CCFFE8', size: 'xs', margin: 'xs', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '14px',
        contents: [
          {
            type: 'text',
            text: `${monthName} ${yearBE}`,
            size: 'md',
            weight: 'bold',
            color: '#111111',
          },
          { type: 'separator', margin: 'sm' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, contents: [
                { type: 'text', text: 'ทั้งหมด', size: 'xxs', color: '#888888', align: 'center' },
                { type: 'text', text: String(params.totalAll), size: 'xl', weight: 'bold', align: 'center', color: '#111111' },
              ]},
              { type: 'box', layout: 'vertical', flex: 1, contents: [
                { type: 'text', text: 'ตรวจแล้ว', size: 'xxs', color: '#888888', align: 'center' },
                { type: 'text', text: `${params.totalDone} (${doneRate}%)`, size: 'sm', weight: 'bold', align: 'center', color: '#1D9E75' },
              ]},
              { type: 'box', layout: 'vertical', flex: 1, contents: [
                { type: 'text', text: 'ผิดปกติ', size: 'xxs', color: '#888888', align: 'center' },
                { type: 'text', text: String(params.totalFail), size: 'xl', weight: 'bold', align: 'center', color: statusColor },
              ]},
            ],
          },
          { type: 'separator', margin: 'sm' },
          { type: 'text', text: statusText, size: 'sm', color: statusColor, margin: 'sm', align: 'center' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '10px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1D9E75',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📄 ดาวน์โหลด PDF',
              uri: params.pdfUrl,
            },
          },
        ],
      },
    },
  }

  return sendLineMessage(channelToken, groupId, [flexMessage])
}

export async function sendOverdueNotify(
  channelToken: string,
  groupId: string,
  params: {
    projectName: string
    overdueItems: { machineName: string; type: string }[]
    date: Date
  }
): Promise<boolean> {
  const dateStr = formatDateTH(params.date)
  const itemLines = params.overdueItems
    .slice(0, 10)
    .map((item, i) => `  ${i + 1}. [${item.type}] ${item.machineName}`)
    .join('\n')
  const moreCount = params.overdueItems.length - 10
  const moreLine = moreCount > 0 ? `\n  ... และอีก ${moreCount} รายการ` : ''

  const message = [
    `⚠️ [PM Overdue Alert]`,
    `โครงการ: ${params.projectName}`,
    `วันที่: ${dateStr}`,
    ``,
    `งานที่เลยกำหนด (${params.overdueItems.length} รายการ):`,
    params.overdueItems.length > 0 ? itemLines + moreLine : '  ไม่มีงานค้าง ✅',
  ].join('\n')

  return sendLineMessage(channelToken, groupId, [{ type: 'text', text: message }])
}

export async function sendTestNotify(
  channelToken: string,
  groupId: string,
  projectName: string
): Promise<boolean> {
  const message = [
    '✅ ทดสอบการแจ้งเตือน Line Messaging API',
    `โครงการ: ${projectName}`,
    'ระบบ PM พร้อมใช้งานแล้ว!',
  ].join('\n')
  return sendLineMessage(channelToken, groupId, [{ type: 'text', text: message }])
}
