import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for auth cookie (httpOnly, set by backend)
  const hasRefreshToken = req.cookies.has('refresh_token')
  // Also check zustand persisted user in localStorage (not accessible in middleware)
  // We rely on the refresh token cookie as the auth signal
  if (!hasRefreshToken && !pathname.startsWith('/_next')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
