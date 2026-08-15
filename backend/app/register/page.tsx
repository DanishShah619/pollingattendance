'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, User, AlertCircle, Loader2, GraduationCap, BookOpen, Shield, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

type Role = 'student' | 'teacher' | 'hod'

const DEPARTMENTS = ['CS', 'ECE', 'EE', 'ME', 'CE', 'IT', 'MBA', 'MCA']

const roleConfig = {
  student: {
    label: 'Student',
    icon: GraduationCap,
    description: 'Mark attendance & vote in classroom polls',
    gradient: 'from-blue-600 to-cyan-600',
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
  },
  teacher: {
    label: 'Teacher',
    icon: BookOpen,
    description: 'Start lecture sessions & launch polls',
    gradient: 'from-purple-600 to-blue-600',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
  },
  hod: {
    label: 'Head of Department',
    icon: Shield,
    description: 'Monitor department-wide attendance & analytics',
    gradient: 'from-amber-600 to-orange-600',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
  },
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — Role selection
  const [selectedRole, setSelectedRole] = useState<Role>('student')

  // Step 2 — Account details
  const [collegeId, setCollegeId]     = useState('')
  const [name, setName]               = useState('')
  const [password, setPassword]       = useState('')
  const [department, setDepartment]   = useState('CS')
  const [semester, setSemester]       = useState(1)

  const [error, setError]   = useState('')
  const [collegeIdError, setCollegeIdError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const redirectByRole = (role: Role) => {
    if (role === 'student')  router.push('/student')
    else if (role === 'teacher') router.push('/teacher')
    else if (role === 'hod') router.push('/hod')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCollegeIdError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId,
          name,
          password,
          role: selectedRole,
          department,
          ...(selectedRole === 'student' ? { semester } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.error || ''
        // College ID conflict — show inline under the field
        if (res.status === 409 || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
          setCollegeIdError(`"${collegeId}" is already taken. Please choose a different College ID.`)
          setLoading(false)
          return
        } else if (res.status === 400 && msg.toLowerCase().includes('semester')) {
          throw new Error('Please select your semester before continuing.')
        } else if (res.status === 429) {
          throw new Error('Too many registration attempts. Please wait a minute and try again.')
        } else if (res.status >= 500) {
          throw new Error('Something went wrong on our end. Please try again shortly.')
        } else {
          throw new Error(msg || 'Registration failed. Please check your details and try again.')
        }
      }

      redirectByRole(selectedRole)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030303] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-600/15 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute top-3/4 left-3/4 -z-10 h-64 w-64 rounded-full bg-pink-600/10 blur-[90px]" />

      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            Join the Platform
          </h1>
          <p className="mt-2 text-sm text-gray-400 font-medium">
            Create your account and start in seconds
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                step >= s ? 'bg-gradient-to-r from-purple-500 to-blue-500' : 'bg-white/10'
              }`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                step >= s ? 'text-purple-400' : 'text-gray-600'
              }`}>
                {s === 1 ? 'Choose Role' : 'Account Details'}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-8 space-y-6">

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Role selection */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white/90">What is your role?</h2>
              <div className="space-y-3">
                {(Object.entries(roleConfig) as [Role, typeof roleConfig.student][]).map(([role, cfg]) => {
                  const Icon = cfg.icon
                  const isSelected = selectedRole === role
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? `${cfg.border} ${cfg.bg}`
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr ${cfg.gradient}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? cfg.text : 'text-white/80'}`}>
                          {cfg.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                      </div>
                      <div className={`h-4 w-4 rounded-full border-2 shrink-0 transition-all ${
                        isSelected ? `${cfg.text.replace('text-', 'border-')} bg-current` : 'border-white/20'
                      }`} />
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setStep(2)}
                className="flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-purple-950/30"
              >
                Continue as {roleConfig[selectedRole].label}
              </button>
            </div>
          )}

          {/* STEP 2: Account details */}
          {step === 2 && (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Back
                </button>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${roleConfig[selectedRole].border} ${roleConfig[selectedRole].bg} ${roleConfig[selectedRole].text}`}>
                  {(() => { const Icon = roleConfig[selectedRole].icon; return <Icon className="h-3.5 w-3.5" /> })()}
                  {roleConfig[selectedRole].label}
                </div>
              </div>

              <h2 className="text-lg font-semibold text-white/90">Create your account</h2>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-9 pr-4 text-white placeholder-gray-500 transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  College ID
                </label>
                <input
                  id="reg-collegeId"
                  type="text"
                  required
                  placeholder={selectedRole === 'student' ? 'e.g. STU2024001' : selectedRole === 'hod' ? 'e.g. HOD001' : 'e.g. TCH001'}
                  value={collegeId}
                  onChange={(e) => { setCollegeId(e.target.value.toUpperCase()); setCollegeIdError('') }}
                  className={`block w-full rounded-xl border bg-white/[0.04] py-3 px-4 text-white placeholder-gray-500 transition-all focus:bg-white/[0.06] focus:outline-none focus:ring-2 text-sm font-mono ${
                    collegeIdError
                      ? 'border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20'
                      : 'border-white/10 focus:border-purple-500/60 focus:ring-purple-500/20'
                  }`}
                />
                {collegeIdError ? (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {collegeIdError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">Must be unique. Used to log in.</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-9 pr-10 text-white placeholder-gray-500 transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
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

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Department</label>
                <select
                  id="reg-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 px-4 text-white transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className="bg-[#121214]">{d}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-600">
                  {selectedRole === 'student'
                    ? 'Students see sessions from teachers in the same department + semester.'
                    : 'Sessions you create will be for students in this department.'}
                </p>
              </div>

              {/* Semester — Students only */}
              {selectedRole === 'student' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Semester</label>
                  <select
                    id="reg-semester"
                    value={semester}
                    onChange={(e) => setSemester(parseInt(e.target.value))}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 px-4 text-white transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s} className="bg-[#121214]">Semester {s}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600">
                    You will see active sessions from teachers targeting this semester + department.
                  </p>
                </div>
              )}

              <button
                id="reg-submit"
                type="submit"
                disabled={loading}
                className="relative flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 py-3 text-sm font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60 shadow-lg shadow-purple-950/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account & Continue'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
