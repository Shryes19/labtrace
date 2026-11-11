// JWT session helpers (work in proxy, server components and route handlers)
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'lt_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || 'dev-only-secret-change-me-in-.env.local-0123456789'
  );
}

export async function createToken(user) {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: Number(payload.sub), role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
  path: '/',
  maxAge: MAX_AGE,
};
