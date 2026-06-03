'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  LogOut, Shield, Users, BookOpen, Clock, 
  ChevronRight, Loader2, AlertTriangle, ArrowRight 
} from 'lucide-react'

interface StudentStat {
  id: string
  name: string
  collegeId: string
  semester: number
  attendanceRate: number
  classesAttended: number
  totalClasses: number
}

interface Session {
  _id: string
  title: string
  subject: string
  semester: number
  isActive: boolean
  createdAt: string
}

export default function HodDashboard() {
  const router = useRouter()
  const [hod, setHod] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [students, setStudents] = useState<StudentStat[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadHodDashboard() {
      try {
        const meRes = await fetch('/api/auth/me')
        if (!meRes.ok) {
          router.push('/login')
          return
        }
        const meData = await meRes.json()
        if (meData.user.role !== 'hod') {
          router.push('/login')
          return
        }
        setHod(meData.user)

        const statsRes = await fetch('/api/hod/stats')
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData.stats)
          setStudents(statsData.students)
          setSessions(statsData.sessions)
        }
      } catch (err) {
        console.error('Failed to load HOD stats:', err)
        setError('Error loading department dashboard data')
      } finally {
        setLoading(false)
      }
    }
    loadHodDashboard()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Loading HOD portal...</p>
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
              HOD
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">HoD Management Dashboard</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-semibold text-purple-400">{hod?.name}</span>
                <span>•</span>
                <span>Dept: {hod?.department}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/teacher')}
              className="rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-gray-300 transition-all border border-white/10"
            >
              Teacher Panel
            </button>
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
        
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Students</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats?.totalStudents || 0}</h3>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <BookOpen className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lectures Started</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats?.totalSessions || 0}</h3>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-ping absolute" />
              <span className="h-2 w-2 rounded-full bg-green-500 absolute" />
              <Clock className="h-6 w-6 text-green-400 ml-1.5" />
            </div>
            <div className="pl-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Lectures</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats?.activeSessions || 0}</h3>
            </div>
          </div>
        </section>

        {/* Student Roster Statistics */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Users className="h-5 w-5 text-purple-400" />
                Department Student Roster
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="px-6 py-3.5">College ID</th>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-6 py-3.5">Semester</th>
                      <th className="px-6 py-3.5">Attendance %</th>
                      <th className="px-6 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.length > 0 ? (
                      students.map((student) => (
                        <tr key={student.id} className="hover:bg-white/[0.01]">
                          <td className="px-6 py-3.5 font-semibold text-white">{student.collegeId}</td>
                          <td className="px-6 py-3.5">{student.name}</td>
                          <td className="px-6 py-3.5">Sem {student.semester}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${
                                student.attendanceRate >= 75 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {student.attendanceRate}%
                              </span>
                              <span className="text-xs text-gray-500">
                                ({student.classesAttended}/{student.totalClasses})
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => router.push(`/hod/student/${student.id}`)}
                              className="inline-flex items-center gap-1 hover:text-white text-purple-400 text-xs font-bold transition-all"
                            >
                              Track Records
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                          No students found in your department.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Department Lectures History */}
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <BookOpen className="h-5 w-5 text-blue-400" />
                Department Lectures
              </h2>

              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div 
                      key={session._id} 
                      onClick={() => router.push(`/teacher/session/${session._id}`)}
                      className="border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl p-4 space-y-2 cursor-pointer transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold text-sm text-white">{session.title}</h4>
                        {session.isActive ? (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-400">{session.subject} • Semester {session.semester}</p>
                      <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 font-mono">
                        <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                        <span className={session.isActive ? 'text-green-400 font-bold' : 'text-gray-500'}>
                          {session.isActive ? 'ACTIVE' : 'CLOSED'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 py-6 text-center">No lectures started yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
