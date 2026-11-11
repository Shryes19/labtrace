import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  const rows = await withUser(user, (c) => c.query('SELECT * FROM spare_parts ORDER BY part_category, part_name').then((r) => r.rows));
  return { parts: rows };
});

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser('admin');
  const b = await readJson(req);
  if (!b.part_no || !b.part_name || !b.part_category) throw new HttpError(400, 'Part number, name and category are required');
  const id = await withUser(user, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO spare_parts (part_no, part_name, part_category, unit_cost, qty_in_stock, reorder_level)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING part_id`,
      [b.part_no.trim().toUpperCase(), b.part_name.trim(), b.part_category.trim(), Number(b.unit_cost || 0),
       Number(b.qty_in_stock || 0), Number(b.reorder_level || 2)]);
    return rows[0].part_id;
  });
  return { ok: true, part_id: id };
});
