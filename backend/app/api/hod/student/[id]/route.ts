import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/model/User'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
import '@/model/Session' // Ensure Session model registered
import { getAuthUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params
    const user = await getAuthUser(['hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const student = await User.findById(studentId)
    if (!student || student.role !== 'student') {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Verify HOD department matches student department
    if (student.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all attendance logs for this student
    const logs = await AttendanceLog.find({ userId: studentId })
      .populate('sessionId', 'title subject startTime endTime centerLat centerLng allowedCells')
      .sort({ checkedInAt: -1 })

    // Fetch all sessions created for this student's semester to identify missing lectures
    const allSemesterSessions = await Session.find({
      department: student.department,
      semester: student.semester,
    }).sort({ createdAt: -1 })

    const attendanceRecords = allSemesterSessions.map((session) => {
      const match = logs.find((log) => (log.sessionId as any)?._id.toString() === session._id.toString())
      return {
        sessionId: session._id.toString(),
        title: session.title,
        subject: session.subject,
        startTime: session.startTime,
        attended: !!match,
        checkedInAt: match ? match.checkedInAt : null,
        checkOutAt: match ? match.checkOutAt : null,
        durationMinutes: match ? match.durationMinutes : null,
        h3Cell: match ? match.h3Cell : null,
      }
    })

    const attendedCount = attendanceRecords.filter((r) => r.attended).length
    const attendanceRate = attendanceRecords.length > 0
      ? Math.round((attendedCount / attendanceRecords.length) * 100)
      : 100

    return NextResponse.json({
      student: {
        id: student._id.toString(),
        name: student.name,
        collegeId: student.collegeId,
        department: student.department,
        semester: student.semester,
      },
      stats: {
        attendanceRate,
        attendedCount,
        totalCount: attendanceRecords.length,
      },
      records: attendanceRecords,
    })

  } catch (error: any) {
    console.error('[API HOD Student Details] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
