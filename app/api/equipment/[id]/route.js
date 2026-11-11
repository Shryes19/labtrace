import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { equipmentFields } from '@/lib/validate';

export const PUT = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('admin');
  const { id } = await params;
  const f = equipmentFields(await readJson(req));
  await withUser(user, async (c) => {
    const r = await c.query(
      `UPDATE equipment SET asset_tag=$1, equipment_name=$2, category_id=$3, lab_id=$4, manufacturer=$5, model_no=$6,
              serial_no=$7, purchase_date=$8, purchase_cost=$9, warranty_expiry=$10, status=$11, specifications=$12
        WHERE equipment_id=$13`,
      [f.asset_tag, f.equipment_name, f.category_id, f.lab_id, f.manufacturer, f.model_no, f.serial_no,
       f.purchase_date, f.purchase_cost, f.warranty_expiry, f.status, JSON.stringify(f.specifications), Number(id)]);
    if (!r.rowCount) throw new HttpError(404, 'Equipment not found');
  });
  return { ok: true };
});

export const DELETE = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('admin');
  const { id } = await params;
  await withUser(user, async (c) => {
    const r = await c.query('DELETE FROM equipment WHERE equipment_id = $1', [Number(id)]);
    if (!r.rowCount) throw new HttpError(404, 'Equipment not found');
  });
  return { ok: true };
});
