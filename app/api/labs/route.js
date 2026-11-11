import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser('admin');
  const b = await readJson(req);
  if (!b.lab_code || !b.lab_name || !b.building || !b.room_no) throw new HttpError(400, 'All fields are required');
  const id = await withUser(user, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO labs (lab_code, lab_name, building, floor_no, room_no, capacity, incharge_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING lab_id`,
      [b.lab_code.trim().toUpperCase(), b.lab_name.trim(), b.building.trim(), Number(b.floor_no || 0),
       b.room_no.trim(), Number(b.capacity || 1), b.incharge_id ? Number(b.incharge_id) : null]);
    return rows[0].lab_id;
  });
  return { ok: true, lab_id: id };
});
