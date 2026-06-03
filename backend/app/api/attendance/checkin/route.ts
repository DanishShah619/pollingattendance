import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { latLngToCell } from 'h3-js'
import { connectDB } from '@/lib/db'
import Session from '@/model/Session'
import AttendanceLog from '@/model/AttendanceLog'
import { getAuthUser } from '@/lib/auth'
import { broadcast } from '@/lib/sse'

const checkInSchema = z.object({
  sessionId: z.string().min(24, 'Invalid session ID'),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(['student'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const result = checkInSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { sessionId, lat, lng, accuracy } = result.data

    // ── 1. Geolocation Accuracy Guard ─────────────────────────────────────────
    if (accuracy > 50) {
      return NextResponse.json(
        { error: 'GPS accuracy is poor (> 50m). Please move to an open area and retry.' },
        { status: 400 }
      )
    }

    // ── 2. Find and Validate Active Session ───────────────────────────────────
    const session = await Session.findById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.isActive) {
      return NextResponse.json({ error: 'Session has already closed' }, { status: 400 })
    }

    // ── 3. H3 Spatial Gate Check ──────────────────────────────────────────────
    const resolution = session.resolution || parseInt(process.env.NEXT_PUBLIC_H3_RESOLUTION ?? '10')
    const studentCell = latLngToCell(lat, lng, resolution)

    if (!session.allowedCells.includes(studentCell)) {
      return NextResponse.json(
        { error: 'You are outside the attendance zone for this lecture' },
        { status: 403 }
      )
    }

    // ── 4. Prevent Duplicate Check-ins ────────────────────────────────────────
    const existingLog = await AttendanceLog.findOne({ userId: user.id, sessionId })
    if (existingLog) {
      return NextResponse.json(
        { error: 'You have already checked in to this session' },
        { status: 400 }
      )
    }

    // ── 5. Record Check-in ────────────────────────────────────────────────────
    const checkedInAt = new Date()
    const log = await AttendanceLog.create({
      userId: user.id,
      sessionId,
      h3Cell: studentCell,
      lat,
      lng,
      gpsAccuracy: accuracy,
      checkedInAt,
    })

    // ── 6. SSE Broadcast ──────────────────────────────────────────────────────
    const eventPayload = {
      type: 'attendance',
      data: {
        logId: log._id.toString(),
        userId: user.id,
        name: user.name,
        collegeId: user.collegeId,
        checkedInAt,
        h3Cell: studentCell,
      },
    }

    // Fails silently if Redis is down, checkin still completes
    await broadcast(sessionId, eventPayload)

    return NextResponse.json({
      success: true,
      message: 'Check-in successful',
      checkedInAt,
      h3Cell: studentCell,
    }, { status: 201 })

  } catch (error: any) {
    console.error('[API Checkin] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
