// String union types (replacing Prisma enums for SQLite compatibility)
export type ProjectType = 'HIGHRISE' | 'LOWRISE_AP' | 'LOWRISE_NONAP'
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TECHNICIAN' | 'ASSIST_ADMIN' | 'BMVM'
export type PMItemType = 'EE' | 'ME'
export type PMPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type ScheduleStatus = 'UPCOMING' | 'TODAY' | 'DONE' | 'OVERDUE' | 'RESCHEDULED'
export type CheckResult = 'PASS' | 'FAIL'
export type ImportStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface ProjectSummary {
  id: string
  code: string
  name: string
  type: ProjectType
  location?: string | null
  color: string
}

export interface PMScheduleWithItem {
  id: string
  pmItemId: string
  scheduledDate: string
  status: ScheduleStatus
  result?: CheckResult | null
  remark?: string | null
  photoUrl?: string | null
  checkedAt?: string | null
  checkedBy?: { id: string; name: string } | null
  rescheduledDate?: string | null
  rescheduledRemark?: string | null
  rescheduledBy?: { id: string; name: string } | null
  pmItem: {
    id: string
    name: string
    number: string
    location?: string | null
    type: PMItemType
    category: string
    subCategory?: string | null
    period: PMPeriod
    no: number
  }
}

export interface DayStats {
  date: string // YYYY-MM-DD
  total: number
  done: number
  overdue: number
  today: number
  upcoming: number
  rescheduled: number
}

export interface MonthStats {
  total: number
  done: number
  overdue: number
  today: number
  upcoming: number
  donePercent: number
}

export interface NavCounts {
  scheduleBadge: number // today + overdue
  overdueBadge: number  // overdue only
}
