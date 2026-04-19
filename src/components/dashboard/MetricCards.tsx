'use client'

interface MetricCardsProps {
  todayCount: number
  doneCount: number
  overdueCount: number
  totalCount: number
  loading?: boolean
}

const Card = ({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
  loading?: boolean
}) => (
  <div className="bg-pm-bg rounded-md p-3 md:p-4">
    <div className="text-[11px] text-pm-text-3 mb-1.5 md:mb-2">{label}</div>
    {loading ? (
      <div className="h-7 w-16 bg-pm-muted rounded animate-pulse" />
    ) : (
      <div className={`text-[22px] md:text-[26px] font-semibold leading-tight ${accent || 'text-pm-text'}`}>
        {value}
      </div>
    )}
    {sub && <div className="text-[10px] md:text-[11px] text-pm-text-3 mt-1 hidden sm:block">{sub}</div>}
  </div>
)

export function MetricCards({ todayCount, doneCount, overdueCount, totalCount, loading }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
      <Card
        label="งานวันนี้"
        value={todayCount}
        sub="รายการรอตรวจวันนี้"
        accent={todayCount > 0 ? 'text-info' : 'text-pm-text'}
        loading={loading}
      />
      <Card
        label="ตรวจแล้ว"
        value={doneCount}
        sub="รายการที่ตรวจแล้ว"
        accent={doneCount > 0 ? 'text-green-600' : 'text-pm-text'}
        loading={loading}
      />
      <Card
        label="งานค้าง"
        value={overdueCount}
        sub="รายการเกินกำหนด"
        accent={overdueCount > 0 ? 'text-danger' : 'text-pm-text'}
        loading={loading}
      />
      <Card
        label="รวมทั้งเดือน"
        value={totalCount}
        sub="รายการ PM ทั้งหมด"
        loading={loading}
      />
    </div>
  )
}
