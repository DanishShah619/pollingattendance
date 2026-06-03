'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { 
  LogOut, User, PlusCircle, BookOpen, Clock, 
  ChevronRight, Loader2, AlertTriangle, CheckCircle2, Satellite, Map
} from 'lucide-react'

// Dynamically import MockGPSPicker to avoid SSR issues
const MockGPSPicker = dynamic(() => import('@/components/MockGPSPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  ),
})

interface Session {
  _id: string
  title: string
  subject: string
  department: string
  semester: number
  isActive: boolean
  createdAt: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [teacher, setTeacher] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form states
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [semester, setSemester] = useState(1)
  const [radiusRings, setRadiusRings] = useState(1)
  const [simCoords, setSimCoords] = useState({
    lat: parseFloat(process.env.NEXT_PUBLIC_COLLEGE_LAT ?? '22.5726'),
    lng: parseFloat(process.env.NEXT_PUBLIC_COLLEGE_LNG ?? '88.3639'),
    accuracy: 10,
  })

  // Toggle between mock GPS picker and real browser geolocation
  const [useMockGPS, setUseMockGPS] = useState(true)

  const fetchDashboardData = async () => {
    try {
      // 1. Get teacher details
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        router.push('/login')
        return
      }
      const meData = await meRes.json()
      setTeacher(meData.user)

      // 2. Fetch created sessions
      const sessionRes = await fetch('/api/session')
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSessions(sessionData.sessions)
      }
    } catch (err) {
      console.error('Failed to load teacher dashboard:', err)
      setError('Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setCreateLoading(true)

    let coords = { lat: simCoords.lat, lng: simCoords.lng }

    if (!useMockGPS) {
      if (!navigator.geolocation) {
        setError('Browser does not support geolocation')
        setCreateLoading(false)
        return
      }

      try {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          })
        })
        coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
      } catch (err: any) {
        setError(`Failed to capture GPS location: ${err.message || 'Timeout'}`)
        setCreateLoading(false)
        return
      }
    }

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          semester,
          radiusRings,
          lat: coords.lat,
          lng: coords.lng,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start lecture')
      }

      setSuccessMsg('Lecture session started!')
      setTitle('')
      setSubject('')
      // Redirect to session detail page
      router.push(`/teacher/session/${data.session._id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to start lecture')
      setCreateLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Loading teacher dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg">
              TCH
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Teacher Portal</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-semibold text-purple-400">{teacher?.name}</span>
                <span>•</span>
                <span>Dept: {teacher?.department}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {teacher?.role === 'hod' && (
              <button
                onClick={() => router.push('/hod')}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-950/20 transition-all"
              >
                HoD Panel
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-sm font-medium text-gray-300 transition-all border border-white/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Session Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-purple-400" />
                Start a New Lecture
              </h2>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Lecture Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Operating Systems — Lecture 12"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 px-4 text-white placeholder-gray-500 transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Subject Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Science CS-402"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 px-4 text-white placeholder-gray-500 transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Target Semester
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(parseInt(e.target.value))}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 px-4 text-white transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s} className="bg-[#121214]">
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      GPS Radius Rings (H3 Boundary)
                    </label>
                    <select
                      value={radiusRings}
                      onChange={(e) => setRadiusRings(parseInt(e.target.value))}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 px-4 text-white transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    >
                      <option value={0} className="bg-[#121214]">0 Rings (~15m Radius)</option>
                      <option value={1} className="bg-[#121214]">1 Ring (~45m Radius)</option>
                      <option value={2} className="bg-[#121214]">2 Rings (~75m Radius)</option>
                      <option value={3} className="bg-[#121214]">3 Rings (~105m Radius)</option>
                    </select>
                  </div>
                </div>

                {/* GPS Mode Toggle + Map Picker */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Lecture Centre Location
                  </label>

                  {/* Toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-2">
                      {useMockGPS
                        ? <Map className="h-4 w-4 text-purple-400" />
                        : <Satellite className="h-4 w-4 text-blue-400" />}
                      <span className="text-sm font-medium text-white/80">
                        {useMockGPS ? 'Mock GPS (Simulated)' : 'Real Device GPS'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseMockGPS((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        useMockGPS ? 'bg-purple-600' : 'bg-blue-600'
                      }`}
                      role="switch"
                      aria-checked={useMockGPS}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          useMockGPS ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {useMockGPS ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Pick the lecture centre on the map or type coordinates. Students must check in from within the purple circle.</p>
                      <MockGPSPicker
                        lat={simCoords.lat}
                        lng={simCoords.lng}
                        onChange={(c) => setSimCoords({ lat: c.lat, lng: c.lng, accuracy: c.accuracy })}
                        centerLat={simCoords.lat}
                        centerLng={simCoords.lng}
                        radiusMeters={
                          radiusRings === 0 ? 15 :
                          radiusRings === 1 ? 45 :
                          radiusRings === 2 ? 75 :
                          105
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-400">
                      <Satellite className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Real GPS Mode Active</p>
                        <p className="text-xs text-gray-400 mt-0.5">Your browser will capture your actual device location when you click Start Live Lecture.</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg shadow-purple-950/30"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initiating lecture session...
                    </>
                  ) : (
                    'Start Live Lecture'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Quick Statistics Sidebar */}
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                Teacher Details
              </h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">Name</span>
                  <span className="font-semibold text-white">{teacher?.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">College ID</span>
                  <span className="font-semibold text-white">{teacher?.collegeId}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400">Department</span>
                  <span className="font-semibold text-white">{teacher?.department}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <BookOpen className="h-5 w-5 text-blue-400" />
            Lecture History
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <tr key={session._id} className="hover:bg-white/[0.01] transition-all">
                      <td className="px-6 py-4 font-semibold text-white">
                        {session.title}
                      </td>
                      <td className="px-6 py-4">
                        {session.subject}
                      </td>
                      <td className="px-6 py-4">
                        Sem {session.semester}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(session.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {session.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-gray-400 border border-white/10">
                            Closed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/teacher/session/${session._id}`)}
                          className="inline-flex items-center gap-1 hover:text-white text-purple-400 text-xs font-semibold transition-all"
                        >
                          View Session
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No sessions created yet. Fill out the form above to start your first live lecture.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
