import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 * Validates session at Vercel edge to prevent client-side layout shifts.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal next paths bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('__session')?.value;

  // Attach session header for downstream Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-authenticated', session ? 'true' : 'false');

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
