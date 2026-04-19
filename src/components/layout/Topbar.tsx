'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { isReadOnly, ROLE_LABELS } from '@/lib/permissions'
import { THAI_MONTHS } from '@/lib/status'

export function Topbar({ title }: { title: string }) {
  const { data: session } = useSession()
  const { currentProject, setCurrentProject, setSidebarOpen } = useProjectStore()
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    const now = new Date()
    const day = now.getDate()
    const month = THAI_MONTHS[now.getMonth()]
    const year = now.getFullYear()
    setCurrentDate(`${day} ${month} ${year}`)
  }, [])

  useEffect(() => {
    if (session?.user?.projects?.length && !currentProject) {
      setCurrentProject(session.user.projects[0])
    }
  }, [session, currentProject, setCurrentProject])

  const projects = session?.user?.projects ?? []
  const role = session?.user?.role ?? ''
  const readOnly = isReadOnly(role)

  return (
    <header className="h-[52px] bg-pm-card border-b border-pm-border flex items-center justify-between px-3 md:px-5 flex-shrink-0">
      {/* Left: Hamburger (mobile) + Title */}
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-1.5 rounded-md text-pm-text-2 hover:bg-pm-bg transition-colors"
          onClick={() => setSidebarOpen(true)}
          aria-label="เปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 className="text-[14px] md:text-[15px] font-medium text-pm-text truncate max-w-[140px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">

        {/* Date — hidden on mobile */}
        <span className="hidden md:block text-[12px] text-pm-text-2">{currentDate}</span>

        {/* Project switcher */}
        {projects.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-1.5 border border-pm-border-strong rounded-md px-2 py-1.5 text-[12px] text-pm-text hover:bg-pm-bg transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentProject?.color || '#1D9E75' }}
              />
              <span className="max-w-[100px] md:max-w-[140px] truncate">{currentProject?.name || 'เลือกโครงการ'}</span>
              <svg className="w-3 h-3 text-pm-text-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {showProjectMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowProjectMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-pm-card border border-pm-border rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setCurrentProject(p); setShowProjectMenu(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-pm-bg text-left transition-colors ${
                        currentProject?.id === p.id ? 'text-accent font-medium' : 'text-pm-text'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="truncate">[{p.code}] {p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-[12px] text-pm-text-2 hover:text-danger transition-colors p-1"
          title="ออกจากระบบ"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
