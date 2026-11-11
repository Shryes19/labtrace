// Server-side auth helpers for Server Components and Route Handlers
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from './session.js';
import { HttpError, toHttpError } from './db.js';

export async function getSession() {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

/** For pages: redirect to /login if not logged in, or to /dashboard if role not allowed. */
export async function requirePageUser(...roles) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (roles.length && !roles.includes(user.role)) redirect('/dashboard?denied=1');
  return user;
}

/** For API routes: throws HttpError 401 / 403. */
export async function requireApiUser(...roles) {
  const user = await getSession();
  if (!user) throw new HttpError(401, 'Please log in');
  if (roles.length && !roles.includes(user.role)) {
    throw new HttpError(403, `This action requires role: ${roles.join(' or ')}`);
  }
  return user;
}

/** Wrap a route handler body: converts thrown errors to JSON responses. */
export function apiHandler(fn) {
  return async (req, ctx) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      const { status, message } = toHttpError(err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
