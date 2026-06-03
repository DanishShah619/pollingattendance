import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Poll from '@/model/Poll'
import AttendanceLog from '@/model/AttendanceLog'
import Vote from '@/model/Vote'
import { getAuthUser } from '@/lib/auth'
import { broadcast } from '@/lib/sse'

const voteSchema = z.object({
  vote: z.enum(['yes', 'no']),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser(['student'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const result = voteSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid vote value. Must be "yes" or "no".', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { vote: voteAnswer } = result.data

    // ── 1. Find Poll ──────────────────────────────────────────────────────────
    const poll = await Poll.findById(id)
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // ── 2. Check if Poll is Open and Not Expired ──────────────────────────────
    if (!poll.isOpen) {
      return NextResponse.json({ error: 'Poll has closed' }, { status: 400 })
    }

    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      // Auto-close it now if we detected it's past expiresAt but timer hasn't fired yet
      poll.isOpen = false
      poll.closedAt = poll.expiresAt
      poll.closedBy = 'timer'
      await poll.save()

      await broadcast(poll.sessionId.toString(), {
        type: 'poll:closed',
        data: {
          pollId: id,
          closedBy: 'timer',
          closedAt: poll.closedAt,
        },
      })

      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 })
    }

    // ── 3. Attendance Guard ───────────────────────────────────────────────────
    const checkedIn = await AttendanceLog.findOne({ userId: user.id, sessionId: poll.sessionId })
    if (!checkedIn) {
      return NextResponse.json(
        { error: 'You must check in to this session before you can vote' },
        { status: 403 }
      )
    }

    // ── 4. Double Voting Prevention ───────────────────────────────────────────
    const existingVote = await Vote.findOne({ pollId: id, userId: user.id })
    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted on this poll' }, { status: 400 })
    }

    // ── 5. Record Vote & Atomically Increment Poll Counter ─────────────────────
    await Vote.create({
      pollId: id,
      userId: user.id,
      sessionId: poll.sessionId,
      answer: voteAnswer,
    })

    // Atomically increment the counts to avoid race conditions
    const updatedPoll = await Poll.findByIdAndUpdate(
      id,
      {
        $inc: {
          yesCount: voteAnswer === 'yes' ? 1 : 0,
          noCount: voteAnswer === 'no' ? 1 : 0,
        },
      },
      { new: true }
    )

    // ── 6. SSE Broadcast ──────────────────────────────────────────────────────
    const ssePayload = {
      type: 'poll:update',
      data: {
        pollId: id,
        yesCount: updatedPoll?.yesCount || 0,
        noCount: updatedPoll?.noCount || 0,
      },
    }
    await broadcast(poll.sessionId.toString(), ssePayload)

    return NextResponse.json({
      success: true,
      message: 'Vote recorded successfully',
    })

  } catch (error: any) {
    console.error('[API Poll Vote] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
