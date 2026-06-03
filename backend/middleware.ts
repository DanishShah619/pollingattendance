// middleware.ts — edge-compatible JWT auth + RBAC
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

// These paths are always public — no JWT required
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

// Page-level role enforcement
const roleRoutes: Record<string, Array<'student' | 'teacher' | 'hod'>> = {
  '/student': ['student'],
  '/teacher': ['teacher', 'hod'],
  '/hod':     ['hod'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Always allow public paths ──────────────────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // ── 2. Require token ──────────────────────────────────────────────────────
  const token = req.cookies.get('token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // ── 3. Verify token ───────────────────────────────────────────────────────
  try {
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role as string

    // ── 4. Page-level role guard ───────────────────────────────────────────
    for (const [prefix, allowed] of Object.entries(roleRoutes)) {
      if (pathname.startsWith(prefix) && !allowed.includes(role as any)) {
        if (pathname.startsWith('/api/')) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    return NextResponse.next()
  } catch {
    // Expired or malformed token
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: [
    // Protected page routes
    '/student/:path*',
    '/teacher/:path*',
    '/hod/:path*',
    // All API routes EXCEPT auth endpoints (handled by PUBLIC_PATHS above)
    '/api/:path*',
  ],
}