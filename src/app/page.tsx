import { redirect } from 'next/navigation'

// Force this page to be dynamic so redirect works correctly at runtime
export const dynamic = 'force-dynamic'

export default function Home() {
  redirect('/login')
}
