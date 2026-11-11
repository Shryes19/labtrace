import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';

// Admin changes role / activates / deactivates a user
export const PATCH = apiHandler(async (req, { params }) => {
  const admin = await requireApiUser('admin');
  const { id } = await params;
  const b = await readJson(req);
  if (Number(id) === admin.id && (b.is_active === false || (b.role && b.role !== 'admin'))) {
    throw new HttpError(400, 'You cannot deactivate or demote your own account');
  }
  const sets = [];
  const p = [];
  if (b.role !== undefined) {
    if (!['student', 'technician', 'admin'].includes(b.role)) throw new HttpError(400, 'Invalid role');
    p.push(b.role); sets.push(`role = $${p.length}`);
  }
  if (b.is_active !== undefined) { p.push(!!b.is_active); sets.push(`is_active = $${p.length}`); }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  p.push(Number(id));
  await withUser(admin, async (c) => {
    const r = await c.query(`UPDATE users SET ${sets.join(', ')} WHERE user_id = $${p.length}`, p);
    if (!r.rowCount) throw new HttpError(404, 'User not found');
  });
  return { ok: true };
});
