import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import AttendanceLog from '@/model/AttendanceLog'
// Import Session so it is registered in Mongoose
import '@/model/Session'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(['student'])
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const logs = await AttendanceLog.find({ userId: user.id })
      .populate('sessionId', 'title subject department semester centerLat centerLng')
      .sort({ checkedInAt: -1 })

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('[API Attendance History] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
