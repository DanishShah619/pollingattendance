import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import AttendanceLog from '@/model/AttendanceLog'
import { getAuthUser } from '@/lib/auth'

const checkOutSchema = z.object({
  sessionId: z.string().min(24, 'Invalid session ID'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(['student'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const result = checkOutSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { sessionId } = result.data

    const log = await AttendanceLog.findOne({ userId: user.id, sessionId })
    if (!log) {
      return NextResponse.json(
        { error: 'Check-in record not found for this session' },
        { status: 404 }
      )
    }

    if (log.checkOutAt) {
      return NextResponse.json(
        { error: 'You have already checked out of this session' },
        { status: 400 }
      )
    }

    const checkOutAt = new Date()
    const durationMinutes = Math.round((checkOutAt.getTime() - log.checkedInAt.getTime()) / 60000)

    log.checkOutAt = checkOutAt
    log.durationMinutes = durationMinutes
    await log.save()

    return NextResponse.json({
      success: true,
      message: 'Checkout successful',
      checkOutAt,
      durationMinutes,
    })

  } catch (error: any) {
    console.error('[API Checkout] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
