import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Poll from '@/model/Poll'
import Session from '@/model/Session'
import Vote from '@/model/Vote'
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

    const poll = await Poll.findById(id)
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Auth check: only the creator or HOD of department can view detailed results
    const session = await Session.findById(poll.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Associated session not found' }, { status: 404 })
    }

    if (user.role === 'teacher' && session.teacherId.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'hod' && session.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Retrieve voter list
    const votes = await Vote.find({ pollId: id })
      .populate('userId', 'collegeId name department semester')
      .sort({ votedAt: 1 })

    return NextResponse.json({
      poll,
      votes,
    })
  } catch (error: any) {
    console.error('[API Poll Results] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
