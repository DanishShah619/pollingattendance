import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Poll from '@/model/Poll'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
import { getAuthUser } from '@/lib/auth'
import { broadcast } from '@/lib/sse'
import { schedulePollClose } from '@/lib/pollScheduler'

const createPollSchema = z.object({
  sessionId: z.string().min(24, 'Invalid session ID'),
  question: z.string().min(1, 'Question is required').max(300, 'Question too long'),
  hasTimeLimit: z.boolean().default(false),
  durationSeconds: z.number().int().min(5).max(600).default(60),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(['teacher', 'hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const result = createPollSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { sessionId, question, hasTimeLimit, durationSeconds } = result.data

    // Verify session exists and is active
    const session = await Session.findById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.isActive) {
      return NextResponse.json({ error: 'Cannot launch poll in a closed session' }, { status: 400 })
    }

    // Verify creator ownership or HOD matching
    if (user.role === 'teacher' && session.teacherId.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'hod' && session.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Count checked-in students (total eligible voters currently active)
    const totalEligible = await AttendanceLog.countDocuments({ sessionId, checkOutAt: null })

    const expiresAt = hasTimeLimit ? new Date(Date.now() + durationSeconds * 1000) : undefined

    const poll = await Poll.create({
      sessionId,
      createdBy: user.id,
      question,
      isOpen: true,
      yesCount: 0,
      noCount: 0,
      totalEligible,
      hasTimeLimit,
      durationSeconds: hasTimeLimit ? durationSeconds : 0,
      expiresAt,
    })

    // Schedule timer auto-close if applicable
    if (hasTimeLimit && expiresAt) {
      schedulePollClose(poll._id.toString(), sessionId, durationSeconds * 1000)
    }

    // Broadcast SSE
    const ssePayload = {
      type: 'poll:new',
      data: {
        _id: poll._id.toString(),
        pollId: poll._id.toString(),
        question: poll.question,
        isOpen: true,
        yesCount: 0,
        noCount: 0,
        hasTimeLimit,
        durationSeconds: poll.durationSeconds,
        expiresAt: poll.expiresAt,
        totalEligible,
      },
    }
    await broadcast(sessionId, ssePayload)

    return NextResponse.json({ poll }, { status: 201 })
  } catch (error: any) {
    console.error('[API Poll POST] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId query param' }, { status: 400 })
    }

    await connectDB()

    const polls = await Poll.find({ sessionId }).sort({ createdAt: -1 })

    // Hide active poll results from students to prevent bandwagon bias
    const sanitizedPolls = polls.map((poll) => {
      if (user.role === 'student' && poll.isOpen) {
        const pollObj = poll.toObject()
        return {
          ...pollObj,
          yesCount: 0,
          noCount: 0,
        }
      }
      return poll
    })

    return NextResponse.json({ polls: sanitizedPolls })
  } catch (error: any) {
    console.error('[API Poll GET] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
