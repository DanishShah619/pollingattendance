'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [collegeId, setCollegeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            redirectByRole(data.user.role)
            return
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkUser()
  }, [])

  const redirectByRole = (role: 'student' | 'teacher' | 'hod') => {
    if (role === 'student') {
      router.push('/student')
    } else if (role === 'teacher') {
      router.push('/teacher')
    } else if (role === 'hod') {
      router.push('/hod')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collegeId, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Map API errors to friendly user-facing messages
        const msg = data.error || ''
        if (res.status === 401 || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('credentials')) {
          throw new Error('Incorrect College ID or password. Please try again.')
        } else if (res.status === 404 || msg.toLowerCase().includes('not found')) {
          throw new Error('No account found with that College ID.')
        } else if (res.status === 429) {
          throw new Error('Too many login attempts. Please wait a minute and try again.')
        } else if (res.status >= 500) {
          throw new Error('Something went wrong on our end. Please try again shortly.')
        } else {
          throw new Error(msg || 'Login failed. Please check your details and try again.')
        }
      }

      redirectByRole(data.user.role)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Verifying session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030303] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient glow shapes */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-600/20 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 rounded-full bg-blue-600/25 blur-[120px]" />

      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            College Attendance
          </h1>
          <p className="mt-2 text-sm text-gray-400 font-medium">
            v2.0 Real-time Attendance & Polling Portal
          </p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white/90">Sign in to your account</h2>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="collegeId" className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                College ID
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="collegeId"
                  name="collegeId"
                  type="text"
                  required
                  placeholder="e.g. STU001 or TCH001"
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-white placeholder-gray-500 transition-all duration-200 focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-10 text-white placeholder-gray-500 transition-all duration-200 focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 py-3 text-sm font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60 shadow-lg shadow-purple-950/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Sign-up link */}
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-purple-400 hover:text-purple-300 transition-colors"
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
