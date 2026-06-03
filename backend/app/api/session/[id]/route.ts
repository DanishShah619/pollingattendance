import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Session from '@/model/Session'
import { getAuthUser } from '@/lib/auth'
import { broadcast } from '@/lib/sse'

const patchSessionSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
})

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

    const session = await Session.findById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Role checks
    if (user.role === 'student') {
      if (session.department !== user.department || session.semester !== user.semester) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (user.role === 'teacher') {
      if (session.department !== user.department) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (user.role === 'hod') {
      if (session.department !== user.department) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ session })
  } catch (error: any) {
    console.error('[API Session Detail GET] Error:', error)
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

    const session = await Session.findById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Auth check: only creator (teacher) or HOD of same department can modify
    if (user.role === 'teacher' && session.teacherId.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'hod' && session.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const result = patchSessionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const updates = result.data
    const wasActive = session.isActive

    if (updates.isActive === false && session.isActive === true) {
      // Closing the session: set endTime to now
      session.isActive = false
      session.endTime = new Date()
    }

    if (updates.title) session.title = updates.title
    if (updates.subject) session.subject = updates.subject

    await session.save()

    // Broadcast session:ended so all subscribed SSE clients (students) update
    // immediately without needing a manual page refresh.
    if (wasActive && !session.isActive) {
      await broadcast(id, {
        type: 'session:ended',
        data: { sessionId: id, endTime: session.endTime },
      })
    }

    return NextResponse.json({ session })
  } catch (error: any) {
    console.error('[API Session Detail PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser(['hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const session = await Session.findById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // HOD must belong to the same department as the session
    if (session.department !== user.department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await Session.findByIdAndDelete(id)

    return NextResponse.json({ success: true, message: 'Session deleted successfully' })
  } catch (error: any) {
    console.error('[API Session Detail DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
