'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Users, Download, HelpCircle, Play, 
  Trash2, Clock, CheckCircle2, Loader2, AlertCircle 
} from 'lucide-react'
import { useSessionSSE } from '@/hooks/useSessionSSE'

interface Session {
  _id: string
  title: string
  subject: string
  department: string
  semester: number
  isActive: boolean
  centerLat: number
  centerLng: number
  allowedCells: string[]
  radiusRings: number
  startTime: string
  endTime: string
}

interface StudentCheckIn {
  _id: string
  userId: {
    _id: string
    collegeId: string
    name: string
  }
  h3Cell: string
  checkedInAt: string
  checkOutAt?: string
  durationMinutes?: number
}

interface Poll {
  _id: string
  question: string
  isOpen: boolean
  hasTimeLimit: boolean
  durationSeconds: number
  expiresAt?: string
  yesCount: number
  noCount: number
  totalEligible: number
}

interface Voter {
  _id: string
  userId: {
    collegeId: string
    name: string
  }
  answer: 'yes' | 'no'
  votedAt: string
}

export default function TeacherSessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  
  // Unwrap params using React.use()
  const { id: sessionId } = use(params)

  const [session, setSession] = useState<Session | null>(null)
  const [roster, setRoster] = useState<StudentCheckIn[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null)
  const [pollVoters, setPollVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Poll creation form
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollHasLimit, setPollHasLimit] = useState(false)
  const [pollDuration, setPollDuration] = useState(60)

  // Fetch all details
  const fetchSessionDetails = async () => {
    try {
      // 1. Fetch Session Info
      const sessRes = await fetch(`/api/session/${sessionId}`)
      if (!sessRes.ok) {
        if (sessRes.status === 401 || sessRes.status === 403) {
          router.push('/login')
          return
        }
        throw new Error('Session not found')
      }
      const sessData = await sessRes.json()
      setSession(sessData.session)

      // 2. Fetch Attendance Roster
      const rosterRes = await fetch(`/api/attendance/session/${sessionId}`)
      if (rosterRes.ok) {
        const rosterData = await rosterRes.json()
        setRoster(rosterData.roster)
      }

      // 3. Fetch Polls list
      const pollRes = await fetch(`/api/poll/session/${sessionId}`)
      if (pollRes.ok) {
        const pollData = await pollRes.json()
        setPolls(pollData.polls)
      }

    } catch (err: any) {
      console.error('Failed to load session details:', err)
      setError(err.message || 'Error loading session')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionDetails()
  }, [sessionId])

  // Fetch voters for a selected poll
  const fetchPollVoters = async (pollId: string) => {
    try {
      const res = await fetch(`/api/poll/results/${pollId}`)
      if (res.ok) {
        const data = await res.json()
        setPollVoters(data.votes)
      }
    } catch (err) {
      console.error('Failed to fetch poll voters:', err)
    }
  }

  useEffect(() => {
    if (selectedPollId) {
      fetchPollVoters(selectedPollId)
    }
  }, [selectedPollId])

  // Real-time SSE updates
  useSessionSSE(
    sessionId,
    {
      onAttendance: (newCheckIn: any) => {
        // Add new student to roster if not already present
        setRoster((prev) => {
          if (prev.some((item) => item.userId?._id === newCheckIn.userId)) return prev
          const newStudent: StudentCheckIn = {
            _id: newCheckIn.logId,
            userId: {
              _id: newCheckIn.userId,
              collegeId: newCheckIn.collegeId,
              name: newCheckIn.name,
            },
            h3Cell: newCheckIn.h3Cell || 'Dynamic H3',
            checkedInAt: newCheckIn.checkedInAt,
          }
          return [...prev, newStudent]
        })
      },
      onPollNew: (newPoll: any) => {
        setPolls((prev) => [newPoll, ...prev])
      },
      onPollUpdate: (pollUpdate: any) => {
        setPolls((prev) =>
          prev.map((p) =>
            p._id === pollUpdate.pollId
              ? { ...p, yesCount: pollUpdate.yesCount, noCount: pollUpdate.noCount }
              : p
          )
        )
        if (selectedPollId === pollUpdate.pollId) {
          refreshPollResults(pollUpdate.pollId)
        }
      },
      onPollClosed: (closedData: any) => {
        setPolls((prev) =>
          prev.map((p) =>
            p._id === closedData.pollId
              ? { ...p, isOpen: false, closedAt: closedData.closedAt }
              : p
          )
        )
      },
      onSessionEnded: () => {
        // Sync UI if session was closed from another tab or device
        setSession((prev) => prev ? { ...prev, isActive: false } : prev)
      },
    }
  )

  const refreshPollResults = async (pollId: string) => {
    try {
      const res = await fetch(`/api/poll/results/${pollId}`)
      if (res.ok) {
        const data = await res.json()
        setPolls((prev) =>
          prev.map((p) => (p._id === pollId ? data.poll : p))
        )
        if (selectedPollId === pollId) {
          setPollVoters(data.votes)
        }
      }
    } catch (err) {
      console.error('Failed to refresh poll results:', err)
    }
  }

  const handleCloseSession = async () => {
    if (!confirm('Are you sure you want to end this lecture? Students will not be able to check-in or vote anymore.')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })

      if (!res.ok) throw new Error('Failed to close lecture')
      const data = await res.json()
      setSession(data.session)
    } catch (err: any) {
      alert(err.message || 'Error ending session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLaunchPoll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pollQuestion.trim()) return
    setActionLoading(true)

    try {
      const res = await fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question: pollQuestion,
          hasTimeLimit: pollHasLimit,
          durationSeconds: pollDuration,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to launch poll')

      setPollQuestion('')
      setPollHasLimit(false)
      // SSE will handle adding the poll to the list, but we can append just in case
      setPolls((prev) => {
        if (prev.some((p) => p._id === data.poll._id)) return prev
        return [data.poll, ...prev]
      })
    } catch (err: any) {
      alert(err.message || 'Error launching poll')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClosePoll = async (pollId: string) => {
    try {
      const res = await fetch(`/api/poll/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to close poll')
      const data = await res.json()
      setPolls((prev) =>
        prev.map((p) => (p._id === pollId ? data.poll : p))
      )
    } catch (err: any) {
      alert(err.message || 'Error closing poll')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Loading lecture detail...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0c] text-white space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-gray-400">Lecture session not found.</p>
        <button onClick={() => router.push('/teacher')} className="text-purple-400 hover:underline">
          Go back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/teacher')}
              className="rounded-lg p-2 hover:bg-white/5 border border-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{session.title}</h1>
              <p className="text-xs text-gray-400">{session.subject} • Semester {session.semester}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.isActive ? (
              <button
                onClick={handleCloseSession}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all"
              >
                End Lecture
              </button>
            ) : (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gray-400 border border-white/10">
                Lecture Closed
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Roster + Poll Results */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Roster Section */}
          <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                Checked-in Students ({roster.length})
              </h2>
              
              <a
                href={`/api/attendance/export/${sessionId}`}
                download
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-gray-300 transition-all border border-white/10 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </div>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto border border-white/5 rounded-xl">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3">College ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Checked In</th>
                    <th className="px-6 py-3">H3 Cell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {roster.length > 0 ? (
                    roster.map((student) => (
                      <tr key={student._id} className="hover:bg-white/[0.01]">
                        <td className="px-6 py-3 font-semibold text-white">{student.userId?.collegeId}</td>
                        <td className="px-6 py-3">{student.userId?.name}</td>
                        <td className="px-6 py-3 text-xs text-gray-400">
                          {new Date(student.checkedInAt).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-3 font-mono text-purple-400 text-xs">{student.h3Cell}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                        No students checked in yet. Real-time entries will load here automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Active/History Polls */}
          <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-pink-400" />
              Classroom Polls
            </h2>

            {polls.length > 0 ? (
              <div className="space-y-6">
                {polls.map((poll) => {
                  const totalVotes = poll.yesCount + poll.noCount
                  const yesPercent = totalVotes > 0 ? Math.round((poll.yesCount / totalVotes) * 100) : 0
                  const noPercent = totalVotes > 0 ? Math.round((poll.noCount / totalVotes) * 100) : 0

                  return (
                    <div key={poll._id} className="border border-white/5 bg-white/[0.01] rounded-xl p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white/90">{poll.question}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Voter Turnout: {totalVotes} / {poll.totalEligible || roster.length} active students
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {poll.isOpen ? (
                            <button
                              onClick={() => handleClosePoll(poll._id)}
                              className="rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs py-1.5 px-3 font-bold transition-all"
                            >
                              Close Poll
                            </button>
                          ) : (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-white/10">
                              Closed
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedPollId(selectedPollId === poll._id ? null : poll._id)}
                            className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs py-1.5 px-3 font-medium transition-all"
                          >
                            {selectedPollId === poll._id ? 'Hide Votes' : 'Voters Roll'}
                          </button>
                        </div>
                      </div>

                      {/* Vote Progress Bars */}
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-emerald-400">YES ({poll.yesCount})</span>
                            <span className="text-gray-400">{yesPercent}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${yesPercent}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-rose-400">NO ({poll.noCount})</span>
                            <span className="text-gray-400">{noPercent}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 transition-all duration-300"
                              style={{ width: `${noPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Inline Voter details list */}
                      {selectedPollId === poll._id && (
                        <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Voter Selection Roll</p>
                          {pollVoters.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {pollVoters.map((v) => (
                                <div key={v._id} className="flex justify-between p-2 rounded bg-white/[0.02]">
                                  <span className="text-gray-300">{v.userId?.name} ({v.userId?.collegeId})</span>
                                  <span className={`font-bold ${v.answer === 'yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {v.answer.toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No votes cast yet.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500">
                No polls have been launched during this lecture.
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Poll Launcher Form */}
        <div className="space-y-6">
          
          {session.isActive && (
            <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-4 w-4 text-pink-400" />
                Launch Live Poll
              </h2>

              <form onSubmit={handleLaunchPoll} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Question / Prompt
                  </label>
                  <textarea
                    required
                    maxLength={300}
                    placeholder="e.g. Do you have any questions on CPU Scheduling?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 px-3 text-white placeholder-gray-500 transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-300">Set Timer Auto-Close</span>
                  <input
                    type="checkbox"
                    checked={pollHasLimit}
                    onChange={(e) => setPollHasLimit(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                  />
                </div>

                {pollHasLimit && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Timer Duration (Seconds)
                    </label>
                    <select
                      value={pollDuration}
                      onChange={(e) => setPollDuration(parseInt(e.target.value))}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 px-3 text-white transition-all focus:border-purple-500/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
                    >
                      <option value={30} className="bg-[#121214]">30 Seconds</option>
                      <option value={60} className="bg-[#121214]">60 Seconds</option>
                      <option value={120} className="bg-[#121214]">2 Minutes</option>
                      <option value={300} className="bg-[#121214]">5 Minutes</option>
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg shadow-pink-950/20"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Launch Poll'}
                </button>
              </form>
            </section>
          )}

          {/* Location Center Map display metadata */}
          <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Lecture Logistics
            </h2>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-500">StartTime</span>
                <span>{new Date(session.startTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-500">Center Lat</span>
                <span>{session.centerLat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-500">Center Lng</span>
                <span>{session.centerLng.toFixed(6)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Allowed Cells</span>
                <span className="font-semibold text-purple-400">{session.allowedCells?.length || 0} cells</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
