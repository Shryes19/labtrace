// Next.js 16 "proxy" (formerly middleware): runs before every page request.
// Front-end route protection + role-based page access.  The API routes and
// PostgreSQL (roles + RLS) enforce the same rules again on the server.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from './lib/session.js';

const PUBLIC = ['/login', '/register'];
const ROLE_PAGES = [
  { prefix: '/analytics', roles: ['admin'] },
  { prefix: '/users', roles: ['admin'] },
  { prefix: '/equipment/new', roles: ['admin'] },
  { prefix: '/knowledge/new', roles: ['technician', 'admin'] },
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const user = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return user ? NextResponse.redirect(new URL('/dashboard', request.url)) : NextResponse.next();
  }
  if (!user) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  const rule = ROLE_PAGES.find((r) => pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(user.role)) {
    return NextResponse.redirect(new URL('/dashboard?denied=1', request.url));
  }
  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', request.url));
  return NextResponse.next();
}

export const config = {
  // all pages except API routes, Next internals and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)'],
};
