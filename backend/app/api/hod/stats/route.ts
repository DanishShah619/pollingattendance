import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/model/User'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(['hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { department } = user

    // 1. Fetch department sessions
    const sessions = await Session.find({ department }).sort({ createdAt: -1 })
    const totalSessions = sessions.length
    const activeSessionsCount = sessions.filter(s => s.isActive).length

    // 2. Fetch department students
    const students = await User.find({ role: 'student', department }).sort({ collegeId: 1 })

    // 3. For each student, compute attendance percentage
    const studentListWithStats = await Promise.all(
      students.map(async (student) => {
        // Count total sessions created for this student's semester in this department
        const totalSemesterSessions = await Session.countDocuments({
          department,
          semester: student.semester,
        })

        // Count how many of those sessions the student checked into
        const studentCheckedInCount = await AttendanceLog.countDocuments({
          userId: student._id,
        })

        const attendanceRate = totalSemesterSessions > 0
          ? Math.round((studentCheckedInCount / totalSemesterSessions) * 100)
          : 100 // 100% if no classes held yet

        return {
          id: student._id.toString(),
          name: student.name,
          collegeId: student.collegeId,
          semester: student.semester,
          attendanceRate,
          classesAttended: studentCheckedInCount,
          totalClasses: totalSemesterSessions,
        }
      })
    )

    return NextResponse.json({
      department,
      stats: {
        totalSessions,
        activeSessions: activeSessionsCount,
        totalStudents: students.length,
      },
      students: studentListWithStats,
      sessions,
    })

  } catch (error: any) {
    console.error('[API HOD Stats] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
