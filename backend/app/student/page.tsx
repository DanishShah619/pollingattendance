'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { 
  LogOut, User, BookOpen, MapPin, CheckCircle2, Clock, 
  HelpCircle, AlertTriangle, Loader2, BarChart2, Satellite, Map 
} from 'lucide-react'
import { useSessionSSE } from '@/hooks/useSessionSSE'

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
  centerLat: number
  centerLng: number
  radiusRings?: number
  startTime: string
}

interface Poll {
  _id: string
  question: string
  isOpen: boolean
  hasTimeLimit: boolean
  durationSeconds: number
  expiresAt?: string
  myVote?: 'yes' | 'no'
}

interface AttendanceLog {
  _id: string
  sessionId: {
    title: string
    subject: string
  }
  h3Cell: string
  checkedInAt: string
  checkOutAt?: string
  durationMinutes?: number
}

export default function StudentDashboard() {
  const router = useRouter()
  const [student, setStudent] = useState<any>(null)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<string | null>(null)
  const [polls, setPolls] = useState<Poll[]>([])
  const [history, setHistory] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // GPS simulation coordinates
  const [simCoords, setSimCoords] = useState({
    lat: parseFloat(process.env.NEXT_PUBLIC_COLLEGE_LAT ?? '22.5726'),
    lng: parseFloat(process.env.NEXT_PUBLIC_COLLEGE_LNG ?? '88.3639'),
    accuracy: 10,
  })

  // Toggle between mock GPS picker and real browser geolocation
  const [useMockGPS, setUseMockGPS] = useState(true)

  // Fetch initial dashboard data
  const fetchData = useCallback(async () => {
    try {
      // 1. Get current student details
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        router.push('/login')
        return
      }
      const meData = await meRes.json()
      setStudent(meData.user)

      // 2. Fetch active sessions matching student's profile
      const sessionRes = await fetch('/api/session')
      let active: Session | null = null
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        active = sessionData.sessions.find((s: Session) => s.isActive) || null
        setActiveSession(active)

        if (active) {
          // 3. If there is an active session, fetch polls for it
          fetchPolls(active._id)
        }
      }

      // 4. Fetch student check-in history
      const historyRes = await fetch('/api/attendance/history')
      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setHistory(historyData.logs)

        // Check if student is already checked in to the active session
        if (active) {
          const matchingLog = historyData.logs.find(
            (log: AttendanceLog) => (log.sessionId as any)?._id === active._id
          )
          if (matchingLog) {
            setIsCheckedIn(true)
            setCheckInTime(matchingLog.checkedInAt)
          } else {
            setIsCheckedIn(false)
            setCheckInTime(null)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Sync check-in state when history or activeSession changes
  useEffect(() => {
    if (activeSession && history.length > 0) {
      const matchingLog = history.find(
        (log) => (log.sessionId as any)?._id === activeSession._id
      )
      if (matchingLog) {
        setIsCheckedIn(true)
        setCheckInTime(matchingLog.checkedInAt)
      } else {
        setIsCheckedIn(false)
        setCheckInTime(null)
      }
    }
  }, [activeSession, history])

  const fetchPolls = useCallback(async (sessId: string) => {
    try {
      const res = await fetch(`/api/poll/session/${sessId}`)
      if (res.ok) {
        const data = await res.json()
        setPolls(data.polls)
      }
    } catch (err) {
      console.error('Failed to fetch polls:', err)
    }
  }, [])

  // ── Poll for a new session when none is active ─────────────────────────────
  // SSE is session-scoped, so we cannot receive a "session started" event
  // via SSE when we are not yet subscribed to any session. Polling every 10s
  // is the correct approach here — it is lightweight and stops the moment a
  // session is detected, at which point SSE takes over for all live updates.
  const activeSessionRef = useRef(activeSession)
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  useEffect(() => {
    // If we already have an active session, SSE handles everything — no need to poll.
    if (activeSession) return

    const pollForNewSession = async () => {
      // Guard: abort if a session appeared while this async call was in-flight
      if (activeSessionRef.current) return
      try {
        const res = await fetch('/api/session')
        if (!res.ok) return
        const data = await res.json()
        const found: Session | null = data.sessions.find((s: Session) => s.isActive) || null
        if (found) {
          setActiveSession(found)
          fetchPolls(found._id)
          // Also refresh attendance history so check-in state is correct
          const histRes = await fetch('/api/attendance/history')
          if (histRes.ok) {
            const histData = await histRes.json()
            setHistory(histData.logs)
          }
        }
      } catch (err) {
        console.error('[Student] Session poll error:', err)
      }
    }

    const intervalId = setInterval(pollForNewSession, 10_000)
    return () => clearInterval(intervalId)
  }, [activeSession, fetchPolls])

  // ── Real-time SSE updates (active only when a session is live) ──────────────
  useSessionSSE(
    activeSession?._id,
    {
      onPollNew: (newPoll: any) => {
        setPolls((prev) => [newPoll, ...prev])
      },
      onPollUpdate: (_updated: any) => {
        // Vote counts are hidden from students while the poll is open,
        // so we only need to signal that something changed — refetching
        // would yield zeroed counts anyway. Nothing to do client-side.
      },
      onPollClosed: (closedData: any) => {
        setPolls((prev) =>
          prev.map((p) =>
            p._id === closedData.pollId
              ? { ...p, isOpen: false }
              : p
          )
        )
      },
      onSessionEnded: () => {
        // Teacher ended the lecture — immediately clear session state so the
        // student sees "No active sessions" without needing a page refresh.
        setActiveSession(null)
        setPolls([])
        setIsCheckedIn(false)
        setCheckInTime(null)
      },
    }
  )

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const handleCheckIn = async () => {
    if (!activeSession) return
    setError('')
    setSuccessMsg('')
    setActionLoading(true)

    let coords = { lat: simCoords.lat, lng: simCoords.lng, accuracy: simCoords.accuracy }

    if (!useMockGPS) {
      // Use real browser geolocation
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser')
        setActionLoading(false)
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
          accuracy: pos.coords.accuracy,
        }
      } catch (err: any) {
        setError(`Failed to retrieve location: ${err.message || 'Timeout'}`)
        setActionLoading(false)
        return
      }
    }

    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession._id,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed')
      }

      setIsCheckedIn(true)
      setCheckInTime(data.checkedInAt)
      setSuccessMsg('Checked in successfully!')
      fetchData() // refresh history
    } catch (err: any) {
      setError(err.message || 'Check-in failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!activeSession) return
    setError('')
    setSuccessMsg('')
    setActionLoading(true)

    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession._id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed')
      }

      setIsCheckedIn(false)
      setCheckInTime(null)
      setSuccessMsg('Checked out successfully!')
      fetchData() // refresh history
    } catch (err: any) {
      setError(err.message || 'Checkout failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVote = async (pollId: string, answer: 'yes' | 'no') => {
    try {
      const res = await fetch(`/api/poll/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: answer }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Voting failed')
        return
      }

      // Mark local vote answer to prevent multiple UI clicks
      setPolls((prev) =>
        prev.map((p) => (p._id === pollId ? { ...p, myVote: answer } : p))
      )
    } catch (err) {
      console.error('Voting failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Loading student portal...</p>
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
              CS
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Student Dashboard</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-semibold text-purple-400">{student?.name}</span>
                <span>•</span>
                <span>ID: {student?.collegeId}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-sm font-medium text-gray-300 transition-all border border-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
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

        {/* Active Lecture Block */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-400" />
                  Active Lecture
                </h2>
                {activeSession ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-ping" />
                    Live Now
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400 border border-white/10">
                    No active sessions
                  </span>
                )}
              </div>

              {activeSession ? (
                <div className="space-y-6">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{activeSession.title}</h3>
                      <p className="text-sm text-gray-400 mt-0.5">{activeSession.subject} • Semester {activeSession.semester}</p>
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Started at {new Date(activeSession.startTime).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isCheckedIn ? (
                        <button
                          onClick={handleCheckOut}
                          disabled={actionLoading}
                          className="flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg shadow-red-950/20"
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Checkout'}
                        </button>
                      ) : (
                        <button
                          onClick={handleCheckIn}
                          disabled={actionLoading}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg shadow-purple-950/30"
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check In'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Checked In status banner */}
                  {isCheckedIn && (
                    <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-400">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <div>
                        <span className="font-semibold">You are checked in!</span>
                        <span className="text-xs block text-gray-400 mt-0.5">
                          Logged at {new Date(checkInTime!).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Geolocation Picker with Toggle */}
                  {!isCheckedIn && (
                    <div className="space-y-3">
                      {/* GPS Mode Toggle */}
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
                          <p className="text-xs text-gray-500">Pick any location on the map or type coordinates. The purple circle shows the lecture&apos;s allowed zone — check in from inside it to succeed.</p>
                          <MockGPSPicker
                            lat={simCoords.lat}
                            lng={simCoords.lng}
                            onChange={(c) => setSimCoords({ lat: c.lat, lng: c.lng, accuracy: c.accuracy })}
                            centerLat={activeSession.centerLat}
                            centerLng={activeSession.centerLng}
                            radiusMeters={
                              activeSession.radiusRings === 0 ? 15 :
                              activeSession.radiusRings === 1 ? 45 :
                              activeSession.radiusRings === 2 ? 75 :
                              105
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-400">
                          <Satellite className="h-5 w-5 shrink-0" />
                          <div>
                            <p className="font-semibold">Real GPS Mode Active</p>
                            <p className="text-xs text-gray-400 mt-0.5">Your browser will request your actual device location when you click Check In.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                  <BookOpen className="h-10 w-10 text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-400">There are no active lecture sessions for you right now.</p>
                  <p className="text-xs text-gray-500 mt-1">Dashboard will update automatically when a teacher initiates a session.</p>
                </div>
              )}
            </div>

            {/* Polls Section */}
            {isCheckedIn && activeSession && (
              <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-pink-400" />
                  Classroom Polls
                </h2>

                {polls.length > 0 ? (
                  <div className="space-y-4">
                    {polls.map((poll) => {
                      const isExpired = poll.expiresAt ? new Date() > new Date(poll.expiresAt) : false
                      const showOpen = poll.isOpen && !isExpired

                      return (
                        <div key={poll._id} className="border border-white/5 bg-white/[0.01] rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <p className="font-semibold text-white/90 text-sm">{poll.question}</p>
                            {showOpen ? (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-semibold text-pink-400 border border-pink-500/20">
                                Open
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-white/10">
                                Closed
                              </span>
                            )}
                          </div>

                          {showOpen ? (
                            poll.myVote ? (
                              <div className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" />
                                You voted: {poll.myVote.toUpperCase()}
                              </div>
                            ) : (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleVote(poll._id, 'yes')}
                                  className="flex-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs py-2 font-bold transition-all"
                                >
                                  Vote YES
                                </button>
                                <button
                                  onClick={() => handleVote(poll._id, 'no')}
                                  className="flex-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs py-2 font-bold transition-all"
                                >
                                  Vote NO
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="text-xs text-gray-500 italic">
                              Voting has closed for this poll.
                            </div>
                          )}

                          {poll.hasTimeLimit && showOpen && poll.expiresAt && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Clock className="h-3 w-3 text-pink-400 animate-pulse" />
                              <span>Closes in {Math.max(0, Math.round((new Date(poll.expiresAt).getTime() - Date.now()) / 1000))}s</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-gray-500">
                    No polls active in this session yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Overview (Sidebar) */}
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                Student Profile
              </h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">Name</span>
                  <span className="font-semibold text-white">{student?.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">College ID</span>
                  <span className="font-semibold text-white">{student?.collegeId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">Department</span>
                  <span className="font-semibold text-white">{student?.department}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400">Semester</span>
                  <span className="font-semibold text-white">{student?.semester}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* History Table */}
        <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-blue-400" />
            Attendance History
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Lecture Title</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Checked In</th>
                  <th className="px-6 py-4">Checked Out</th>
                  <th className="px-6 py-4">Duration (Min)</th>
                  <th className="px-6 py-4">H3 Cell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.length > 0 ? (
                  history.map((log) => (
                    <tr key={log._id} className="hover:bg-white/[0.01] transition-all">
                      <td className="px-6 py-4 font-semibold text-white">
                        {log.sessionId?.title || 'Unknown Lecture'}
                      </td>
                      <td className="px-6 py-4">
                        {log.sessionId?.subject || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {new Date(log.checkedInAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {log.checkOutAt ? new Date(log.checkOutAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {log.durationMinutes !== null && log.durationMinutes !== undefined
                          ? `${log.durationMinutes} min`
                          : 'In progress'}
                      </td>
                      <td className="px-6 py-4 font-mono text-purple-400 text-xs">
                        {log.h3Cell}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No check-in records found.
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
