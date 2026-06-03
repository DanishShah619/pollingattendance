import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Session from '@/model/Session'
import { getAuthUser } from '@/lib/auth'
import { computeZone } from '@/lib/h3'

const createSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subject: z.string().min(1, 'Subject is required'),
  semester: z.number().int().min(1).max(8),
  lat: z.number(),
  lng: z.number(),
  radiusRings: z.number().int().min(0).max(5).default(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(['teacher', 'hod'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const result = createSessionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { title, subject, semester, lat, lng, radiusRings } = result.data

    // Compute H3 cells covering the location
    const resolution = parseInt(process.env.NEXT_PUBLIC_H3_RESOLUTION ?? '10')
    const allowedCells = computeZone(lat, lng, radiusRings, resolution)

    // Set startTime to now, default endTime to 1 hour from now
    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    const session = await Session.create({
      title,
      subject,
      teacherId: user.id,
      department: user.department,
      semester,
      allowedCells,
      centerLat: lat,
      centerLng: lng,
      radiusRings,
      resolution,
      startTime,
      endTime,
      isActive: true,
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error: any) {
    console.error('[API Session POST] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    let query: any = {}

    if (user.role === 'student') {
      // Students only see active sessions for their department and semester
      query = {
        department: user.department,
        semester: user.semester,
        isActive: true,
      }
    } else if (user.role === 'teacher') {
      // Teachers see all sessions they created
      query = { teacherId: user.id }
    } else if (user.role === 'hod') {
      // HODs see all sessions in their department
      query = { department: user.department }
    }

    // Sort by createdAt descending (newest sessions first)
    const sessions = await Session.find(query).sort({ createdAt: -1 })
    return NextResponse.json({ sessions })
  } catch (error: any) {
    console.error('[API Session GET] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
