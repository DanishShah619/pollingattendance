import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/model/User'
import { signToken, buildAuthCookie } from '@/lib/auth'

const registerSchema = z.object({
  collegeId: z.string().min(2, 'College ID must be at least 2 characters'),
  name:      z.string().min(2, 'Name must be at least 2 characters'),
  password:  z.string().min(6, 'Password must be at least 6 characters'),
  role:      z.enum(['student', 'teacher', 'hod']),
  department: z.string().min(1, 'Department is required'),
  semester:  z.number().int().min(1).max(8).optional(),
})

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const result = registerSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { collegeId, name, password, role, department, semester } = result.data
    const normalizedCollegeId = collegeId.toUpperCase().trim()

    // Enforce: students must provide a semester
    if (role === 'student' && !semester) {
      return NextResponse.json(
        { error: 'Semester is required for student accounts' },
        { status: 400 }
      )
    }

    // Check for existing user
    const existing = await User.findOne({ collegeId: normalizedCollegeId })
    if (existing) {
      return NextResponse.json(
        { error: `College ID "${normalizedCollegeId}" is already taken. Please choose a different one.` },
        { status: 409 }
      )
    }

    const passwordHash = await hash(password, 10)

    const user = await User.create({
      collegeId:    normalizedCollegeId,
      name:         name.trim(),
      passwordHash,
      role,
      department:   department.toUpperCase().trim(),
      ...(role === 'student' && semester ? { semester } : {}),
    })

    const payload = {
      id:         user._id.toString(),
      name:       user.name,
      role:       user.role,
      collegeId:  user.collegeId,
      department: user.department,
      semester:   user.semester,
    }

    const token = signToken(payload)
    const cookieHeader = buildAuthCookie(token)

    const response = NextResponse.json({ user: payload }, { status: 201 })
    response.headers.set('Set-Cookie', cookieHeader)

    return response
  } catch (error: any) {
    console.error('[API Auth Register] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
