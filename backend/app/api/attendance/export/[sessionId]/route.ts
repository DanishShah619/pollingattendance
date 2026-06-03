import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
import '@/model/User'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const user = await getAuthUser(['teacher', 'hod'])
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    await connectDB()

    const session = await Session.findById(sessionId)
    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    // Role checks
    if (user.role === 'teacher' && session.teacherId.toString() !== user.id) {
      return new Response('Forbidden', { status: 403 })
    }
    if (user.role === 'hod' && session.department !== user.department) {
      return new Response('Forbidden', { status: 403 })
    }

    // Fetch and populate roster
    const roster = await AttendanceLog.find({ sessionId })
      .populate('userId', 'collegeId name department semester')
      .sort({ checkedInAt: 1 })

    // Create ReadableStream to stream the CSV
    const encoder = new TextEncoder()
    const csvStream = new ReadableStream({
      async start(controller) {
        // Enqueue header
        controller.enqueue(
          encoder.encode('College ID,Name,Department,Semester,Checked In At,Checked Out At,Duration (Minutes)\n')
        )

        // Enqueue each row
        for (const log of roster) {
          const student = log.userId as any
          const collegeId = student?.collegeId || ''
          const name = student?.name || ''
          const dept = student?.department || ''
          const sem = student?.semester || ''
          const checkInStr = log.checkedInAt ? log.checkedInAt.toISOString() : ''
          const checkOutStr = log.checkOutAt ? log.checkOutAt.toISOString() : ''
          const durationStr = log.durationMinutes !== null && log.durationMinutes !== undefined ? log.durationMinutes.toString() : ''

          const line = `"${collegeId.replace(/"/g, '""')}","${name.replace(/"/g, '""')}","${dept.replace(/"/g, '""')}","${sem}","${checkInStr}","${checkOutStr}","${durationStr}"\n`
          controller.enqueue(encoder.encode(line))
        }

        controller.close()
      },
    })

    const safeTitle = session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    return new Response(csvStream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance-${safeTitle}-${sessionId}.csv"`,
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error: any) {
    console.error('[API CSV Export] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
