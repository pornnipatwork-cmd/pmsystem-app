'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading' || !session || session.user.role !== 'SUPER_ADMIN') {
    return null
  }

  return <>{children}</>
}
