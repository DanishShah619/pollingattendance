import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/model/User'
import { signToken, buildAuthCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

const loginSchema = z.object({
  collegeId: z.string().min(1, 'College ID is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  try {
    const ip = (req as any).ip || req.headers.get('x-forwarded-for') || '127.0.0.1'
    const isLimited = await checkRateLimit(ip, 5, 60)
    if (isLimited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a minute.' },
        { status: 429 }
      )
    }

    await connectDB()

    const body = await req.json()
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { collegeId, password } = result.data
    const normalizedCollegeId = collegeId.toUpperCase().trim()

    const user = await User.findOne({ collegeId: normalizedCollegeId })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isMatch = await compare(password, user.passwordHash)
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const payload = {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      collegeId: user.collegeId,
      department: user.department,
      semester: user.semester,
    }

    const token = signToken(payload)
    const cookieHeader = buildAuthCookie(token)

    const response = NextResponse.json({ user: payload })
    response.headers.set('Set-Cookie', cookieHeader)

    return response
  } catch (error: any) {
    console.error('[API Auth Login] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
