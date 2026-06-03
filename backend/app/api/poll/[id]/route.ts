import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Poll from '@/model/Poll'
import Session from '@/model/Session'
import { getAuthUser } from '@/lib/auth'
import { broadcast } from '@/lib/sse'
import { cancelPollTimer } from '@/lib/pollScheduler'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const poll = await Poll.findById(id)
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Hide active results from students
    if (user.role === 'student' && poll.isOpen) {
      const pollObj = poll.toObject()
      return NextResponse.json({
        poll: {
          ...pollObj,
          yesCount: 0,
          noCount: 0,
        },
      })
    }

    return NextResponse.json({ poll })
  } catch (error: any) {
    console.error('[API Poll Detail GET] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
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

    // Auth check: only the creator or HOD of department can close the poll
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

    if (!poll.isOpen) {
      return NextResponse.json({ error: 'Poll is already closed' }, { status: 400 })
    }

    // Close poll
    poll.isOpen = false
    poll.closedAt = new Date()
    poll.closedBy = 'manual'
    await poll.save()

    // Cancel active timer if it exists
    cancelPollTimer(id)

    // Broadcast SSE
    const ssePayload = {
      type: 'poll:closed',
      data: {
        pollId: id,
        closedBy: 'manual',
        closedAt: poll.closedAt,
      },
    }
    await broadcast(session._id.toString(), ssePayload)

    return NextResponse.json({ poll })
  } catch (error: any) {
    console.error('[API Poll Detail PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
