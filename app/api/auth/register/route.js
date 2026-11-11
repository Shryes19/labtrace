import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { anonQuery, HttpError } from '@/lib/db';
import { apiHandler, readJson } from '@/lib/auth';
import { createToken, SESSION_COOKIE, cookieOptions } from '@/lib/session';

// Self-registration is only for STUDENTS. Technicians / admins are created by an admin.
export const POST = apiHandler(async (req) => {
  const { srn, name, email, password, department } = await readJson(req);
  if (!srn || !/^[A-Za-z0-9]{6,20}$/.test(srn)) throw new HttpError(400, 'Enter a valid SRN (letters and digits only)');
  if (!name || name.trim().length < 3) throw new HttpError(400, 'Enter your full name');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await anonQuery('SELECT fn_register_student($1,$2,$3,$4,$5) AS id',
    [srn.trim(), name.trim(), email.trim(), hash, department?.trim() || null]);
  const token = await createToken({ id: rows[0].id, role: 'student', name: name.trim() });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
});
