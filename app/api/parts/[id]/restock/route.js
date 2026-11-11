import { withUser } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';

export const POST = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('admin');
  const { id } = await params;
  const { quantity } = await readJson(req);
  await withUser(user, (c) => c.query('CALL sp_restock_part($1, $2)', [Number(id), Number(quantity)]));
  return { ok: true };
});
