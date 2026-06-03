// lib/auth.ts — centralised JWT helpers
import { sign, verify, SignOptions } from 'jsonwebtoken'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn']

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable.')
}

export interface JWTPayload {
  id: string
  name: string
  role: 'student' | 'teacher' | 'hod'
  collegeId: string
  department: string
  semester?: number
}

// ─── Token signing (Node.js API routes only) ────────────────────────────────

/**
 * Sign a JWT with the user payload.
 * Only call this from Node.js route handlers (not edge middleware).
 */
export function signToken(payload: JWTPayload): string {
  return sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Verify a token string synchronously (Node.js only).
 * Returns null on any error — never throws.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// ─── Auth guard for App Router route handlers ────────────────────────────────

/**
 * Read and verify the JWT from the request cookie in an App Router handler.
 * Optionally restrict to specific roles.
 *
 * @example
 * const user = await getAuthUser(['teacher', 'hod'])
 * if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function getAuthUser(
  allowedRoles?: Array<'student' | 'teacher' | 'hod'>
): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return null

    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    if (
      allowedRoles &&
      !allowedRoles.includes(payload.role as 'student' | 'teacher' | 'hod')
    ) {
      return null
    }

    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/**
 * Build the Set-Cookie header value for the auth token.
 * Use this in login route responses.
 */
export function buildAuthCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  return [
    `token=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    'Max-Age=604800', // 7 days in seconds
  ]
    .filter(Boolean)
    .join('; ')
}

/**
 * Build the Set-Cookie header value that clears the auth token.
 * Use this in logout route responses.
 */
export function clearAuthCookie(): string {
  return 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
}
