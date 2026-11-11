import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { anonQuery, HttpError } from '@/lib/db';
import { apiHandler, readJson } from '@/lib/auth';
import { createToken, SESSION_COOKIE, cookieOptions } from '@/lib/session';

export const POST = apiHandler(async (req) => {
  const { email, password } = await readJson(req);
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  // SECURITY DEFINER function - the only thing the app login role can run before login
  const { rows } = await anonQuery('SELECT * FROM fn_auth_lookup($1)', [email.trim()]);
  const u = rows[0];
  const ok = u && (await bcrypt.compare(password, u.password_hash));
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  if (!u.is_active) throw new HttpError(403, 'Your account has been deactivated');
  const token = await createToken({ id: u.user_id, role: u.role, name: u.full_name });
  const res = NextResponse.json({ ok: true, user: { id: u.user_id, name: u.full_name, role: u.role } });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
});
