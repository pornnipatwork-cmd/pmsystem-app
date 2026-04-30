'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { useProjectStore } from '@/store/projectStore'
import { isAdmin } from '@/lib/permissions'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const NavItem = ({
  href,
  icon,
  label,
  badge,
  badgeColor = 'bg-danger',
  active,
  onClick,
}: {
  href: string
  icon: React.ReactNode
  label: string
  badge?: number
  badgeColor?: string
  active: boolean
  onClick?: () => void
}) => (
  <Link
    href={href}
    onClick={onClick}
    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] mb-0.5 transition-colors ${
      active
        ? 'bg-accent-light text-accent-dark font-medium'
        : 'text-pm-text-2 hover:bg-pm-bg hover:text-pm-text'
    }`}
  >
    <span className="w-4 h-4 flex-shrink-0">{icon}</span>
    <span className="flex-1">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={`${badgeColor} text-white text-[10px] rounded-full px-1.5 py-px font-medium`}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Link>
)

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { currentProjectId } = useProjectStore()

  const { data: counts } = useSWR(
    currentProjectId ? `/api/pm-schedules/counts?projectId=${currentProjectId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const scheduleBadge = counts?.scheduleBadge ?? 0
  const overdueBadge = counts?.overdueBadge ?? 0
  const admin = isAdmin(session?.user?.role ?? '')
  const superAdmin = session?.user?.role === 'SUPER_ADMIN'

  return (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-pm-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-medium text-pm-text leading-tight">PM System</div>
            <div className="text-[11px] text-pm-text-2">Preventive Maintenance</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <div className="text-[10px] text-pm-text-3 px-2 pt-3 pb-1 tracking-wider uppercase">เมนูหลัก</div>

        <NavItem
          href="/dashboard"
          active={pathname === '/dashboard'}
          onClick={onNavClick}
          icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
          label="Dashboard"
        />
        <NavItem
          href="/schedule"
          active={pathname === '/schedule'}
          onClick={onNavClick}
          icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          label="ตารางงาน"
          badge={scheduleBadge}
          badgeColor="bg-info"
        />
        <NavItem
          href="/overdue"
          active={pathname === '/overdue'}
          onClick={onNavClick}
          icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          label="งานค้าง"
          badge={overdueBadge}
          badgeColor="bg-danger"
        />
        <NavItem
          href="/report"
          active={pathname === '/report'}
          onClick={onNavClick}
          icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          label="รายงาน"
        />

        {session?.user?.role === 'ENGINEER' && (
          <NavItem
            href="/team"
            active={pathname === '/team'}
            onClick={onNavClick}
            icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
            label="จัดการผู้ใช้งาน"
          />
        )}

        {admin && (
          <NavItem
            href="/import"
            active={pathname === '/import'}
            onClick={onNavClick}
            icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>}
            label="นำเข้า Excel"
          />
        )}

        {admin && (
          <>
            <div className="text-[10px] text-pm-text-3 px-2 pt-4 pb-1 tracking-wider uppercase">Admin</div>
            <NavItem
              href="/admin/overview"
              active={pathname.startsWith('/admin/overview')}
              onClick={onNavClick}
              icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
              label="ภาพรวมทั้งหมด"
            />
            <NavItem
              href="/admin/projects"
              active={pathname.startsWith('/admin/projects')}
              onClick={onNavClick}
              icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
              label="จัดการโครงการ"
            />
            <NavItem
              href="/admin/users"
              active={pathname.startsWith('/admin/users')}
              onClick={onNavClick}
              icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
              label="จัดการผู้ใช้งาน"
            />
            <NavItem
              href="/admin/data"
              active={pathname.startsWith('/admin/data')}
              onClick={onNavClick}
              icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>}
              label="จัดการข้อมูล"
            />
            {superAdmin && (
              <>
                <NavItem
                  href="/admin/line"
                  active={pathname.startsWith('/admin/line')}
                  onClick={onNavClick}
                  icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>}
                  label="Line Notify"
                />
                <NavItem
                  href="/admin/usage"
                  active={pathname.startsWith('/admin/usage')}
                  onClick={onNavClick}
                  icon={<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
                  label="สถิติการใช้งาน"
                />
              </>
            )}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-pm-border">
        <div className="text-[12px] font-medium text-pm-text truncate">{session?.user?.name}</div>
        <div className="text-[11px] text-pm-text-3">{session?.user?.username}</div>
      </div>
    </>
  )
}

// Desktop sidebar
export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[220px] bg-pm-card border-r border-pm-border flex-col flex-shrink-0">
      <SidebarContent />
    </aside>
  )
}

// Mobile drawer overlay
export function MobileDrawer() {
  const { sidebarOpen, setSidebarOpen } = useProjectStore()

  if (!sidebarOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
      {/* Drawer */}
      <aside className="fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-pm-card border-r border-pm-border flex flex-col md:hidden shadow-xl">
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>
    </>
  )
}

// Bottom navigation for mobile
export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { currentProjectId } = useProjectStore()
  const admin = isAdmin(session?.user?.role ?? '')
  const superAdmin = session?.user?.role === 'SUPER_ADMIN'

  const { data: counts } = useSWR(
    currentProjectId ? `/api/pm-schedules/counts?projectId=${currentProjectId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const scheduleBadge = counts?.scheduleBadge ?? 0
  const overdueBadge = counts?.overdueBadge ?? 0

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      active: pathname === '/dashboard',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      href: '/schedule',
      label: 'ตารางงาน',
      active: pathname === '/schedule',
      badge: scheduleBadge,
      badgeColor: 'bg-info',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      href: '/overdue',
      label: 'งานค้าง',
      active: pathname === '/overdue',
      badge: overdueBadge,
      badgeColor: 'bg-danger',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
    },
    {
      href: '/report',
      label: 'รายงาน',
      active: pathname === '/report',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      ),
    },
    ...(session?.user?.role === 'ENGINEER' ? [{
      href: '/team',
      label: 'ทีมงาน',
      active: pathname === '/team',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      ),
    }] : []),
    ...(admin ? [{
      href: '/import',
      label: 'นำเข้า',
      active: pathname === '/import',
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
      ),
    }] : []),
    ...(superAdmin ? [{
      href: '/admin/overview',
      label: 'Admin',
      active: pathname.startsWith('/admin'),
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      ),
    }] : []),
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-pm-card border-t border-pm-border md:hidden">
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
              item.active ? 'text-accent' : 'text-pm-text-3'
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.badge > 0 && (
                <span className={`absolute -top-1 -right-1 ${item.badgeColor || 'bg-danger'} text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold`}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">{item.label}</span>
            {item.active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
