import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Poll from '@/model/Poll'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const polls = await Poll.find({ sessionId }).sort({ createdAt: -1 })

    // Hide active results from students
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
    console.error('[API Poll Session List] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
