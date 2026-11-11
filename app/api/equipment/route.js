import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { listEquipment } from '@/lib/queries';
import { equipmentFields } from '@/lib/validate';

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  return { equipment: await withUser(user, (c) => listEquipment(c, sp)) };
});

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser('admin');
  const f = equipmentFields(await readJson(req));
  const id = await withUser(user, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO equipment (asset_tag, equipment_name, category_id, lab_id, manufacturer, model_no, serial_no,
                              purchase_date, purchase_cost, warranty_expiry, status, specifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING equipment_id`,
      [f.asset_tag, f.equipment_name, f.category_id, f.lab_id, f.manufacturer, f.model_no, f.serial_no,
       f.purchase_date, f.purchase_cost, f.warranty_expiry, f.status, JSON.stringify(f.specifications)]);
    return rows[0].equipment_id;
  });
  return { ok: true, equipment_id: id };
});
