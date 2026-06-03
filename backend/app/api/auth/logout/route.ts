import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({ success: true })
    response.headers.set('Set-Cookie', clearAuthCookie())
    return response
  } catch (error: any) {
    console.error('[API Auth Logout] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
