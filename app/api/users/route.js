import bcrypt from 'bcryptjs';
import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';

// Admin creates staff / student accounts
export const POST = apiHandler(async (req) => {
  const admin = await requireApiUser('admin');
  const b = await readJson(req);
  if (!['student', 'technician', 'admin'].includes(b.role)) throw new HttpError(400, 'Invalid role');
  if (!b.institution_id || !b.full_name || !b.email || !b.password) throw new HttpError(400, 'All fields are required');
  if (b.password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(b.password, 10);
  const id = await withUser(admin, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (institution_id, full_name, email, password_hash, role, department)
       VALUES ($1,$2,lower($3),$4,$5,$6) RETURNING user_id`,
      [b.institution_id.trim().toUpperCase(), b.full_name.trim(), b.email.trim(), hash, b.role, b.department || null]);
    const uid = rows[0].user_id;
    for (const cat of b.skills || []) {
      await c.query('INSERT INTO technician_skills (technician_id, category_id, proficiency) VALUES ($1,$2,3)', [uid, Number(cat)]);
    }
    return uid;
  });
  return { ok: true, user_id: id };
});
