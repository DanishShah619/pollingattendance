'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, User, Calendar, CheckCircle2, 
  XCircle, Clock, Loader2, AlertCircle 
} from 'lucide-react'

interface Student {
  id: string
  name: string
  collegeId: string
  department: string
  semester: number
}

interface AttendanceRecord {
  sessionId: string
  title: string
  subject: string
  startTime: string
  attended: boolean
  checkedInAt: string | null
  checkOutAt: string | null
  durationMinutes: number | null
  h3Cell: string | null
}

export default function HodStudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  
  // Unwrap params using React.use()
  const { id: studentId } = use(params)

  const [student, setStudent] = useState<Student | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStudentRecords() {
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

        const res = await fetch(`/api/hod/student/${studentId}`)
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('You do not have permission to view this student')
          }
          throw new Error('Student records not found')
        }
        const data = await res.json()
        setStudent(data.student)
        setStats(data.stats)
        setRecords(data.records)
      } catch (err: any) {
        console.error('Failed to load student details:', err)
        setError(err.message || 'Error loading student details')
      } finally {
        setLoading(false)
      }
    }
    loadStudentRecords()
  }, [studentId, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-gray-400">Loading student attendance log...</p>
        </div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0c] text-white space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-gray-400">{error || 'Student not found.'}</p>
        <button onClick={() => router.push('/hod')} className="text-purple-400 hover:underline">
          Go back to department dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <button 
            onClick={() => router.push('/hod')}
            className="rounded-lg p-2 hover:bg-white/5 border border-white/10 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Student Audit Log</h1>
            <p className="text-xs text-gray-400">Track and inspect attendance timestamps</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* Student Stats overview card */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl md:col-span-2 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <User className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{student.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                ID: <span className="font-mono text-gray-300">{student.collegeId}</span> • Department: {student.department} • Semester: {student.semester}
              </p>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attendance Rate</p>
              <h3 className={`text-2xl font-black mt-1 ${stats?.attendanceRate >= 75 ? 'text-green-400' : 'text-red-400'}`}>
                {stats?.attendanceRate}%
              </h3>
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                Attended {stats?.attendedCount} of {stats?.totalCount} lectures
              </p>
            </div>
            
            <div className={`h-12 w-12 rounded-full border-4 flex items-center justify-center font-bold text-sm ${
              stats?.attendanceRate >= 75 
                ? 'border-green-500/20 text-green-400 border-t-green-500' 
                : 'border-red-500/20 text-red-400 border-t-red-500'
            }`}>
              {stats?.attendanceRate}%
            </div>
          </div>

        </section>

        {/* Audit Log Table */}
        <section className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-blue-400" />
            Lecture Audit Log
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Lecture / Subject</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Checked In</th>
                  <th className="px-6 py-4">Checked Out</th>
                  <th className="px-6 py-4">Duration (Min)</th>
                  <th className="px-6 py-4">H3 Cell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.sessionId} className="hover:bg-white/[0.01] transition-all">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white block">{record.title}</span>
                        <span className="text-xs text-gray-400">{record.subject}</span>
                      </td>
                      <td className="px-6 py-4">
                        {record.attended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Attended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
                            <XCircle className="h-3 w-3" />
                            Absent
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">
                        {record.checkedInAt ? new Date(record.checkedInAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">
                        {record.checkOutAt ? new Date(record.checkOutAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {record.attended 
                          ? (record.durationMinutes !== null && record.durationMinutes !== undefined 
                            ? `${record.durationMinutes} min` 
                            : 'No checkout')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 font-mono text-purple-400 text-xs">
                        {record.h3Cell || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No lectures recorded for this student's semester yet.
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
