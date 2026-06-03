import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
// Import User model so it is registered in mongoose schema cache
import '@/model/User'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser(['teacher', 'hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const session = await Session.findById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Role checks: teacher must be creator; HOD must match department
    if (user.role === 'teacher' && session.teacherId.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'hod' && session.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const roster = await AttendanceLog.find({ sessionId: id })
      .populate('userId', 'collegeId name department semester')
      .sort({ checkedInAt: 1 })

    return NextResponse.json({ roster })
  } catch (error: any) {
    console.error('[API Session Roster] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
