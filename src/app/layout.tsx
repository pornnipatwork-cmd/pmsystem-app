import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'PM System — Preventive Maintenance',
  description: 'ระบบบริหารจัดการงาน Preventive Maintenance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
