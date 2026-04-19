'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('กรุณากรอก Username และ Password')
      return
    }
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.ok) {
      router.push('/dashboard')
    } else {
      setError('Username หรือ Password ไม่ถูกต้อง')
    }
  }

  return (
    <div className="fixed inset-0 bg-pm-bg flex items-center justify-center">
      <div className="bg-pm-card border border-pm-border rounded-lg p-6 md:p-8 w-full max-w-[360px] mx-4 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 bg-accent rounded-[10px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold text-pm-text">PM System</div>
            <div className="text-[11px] text-pm-text-2">Preventive Maintenance</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-3 py-2.5 border border-pm-border-strong rounded-md text-[13px] text-pm-text bg-pm-card outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
              placeholder="กรอก username"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-[11px] font-medium text-pm-text-2 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-pm-border-strong rounded-md text-[13px] text-pm-text bg-pm-card outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
              placeholder="กรอก password"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[12px] text-danger text-center mb-3">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:opacity-90 disabled:opacity-60 text-pm-text rounded-md text-[14px] font-medium transition-opacity"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

      </div>
    </div>
  )
}
