'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isAdmin } from '@/lib/permissions'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session || !isAdmin(session.user.role)) {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading' || !session || !isAdmin(session.user.role)) {
    return null
  }

  return <>{children}</>
}
