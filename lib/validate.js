import { HttpError } from './db.js';

export function equipmentFields(b) {
  const f = {
    asset_tag: b.asset_tag?.trim().toUpperCase(),
    equipment_name: b.equipment_name?.trim(),
    category_id: Number(b.category_id),
    lab_id: Number(b.lab_id),
    manufacturer: b.manufacturer?.trim() || null,
    model_no: b.model_no?.trim() || null,
    serial_no: b.serial_no?.trim() || null,
    purchase_date: b.purchase_date,
    purchase_cost: Number(b.purchase_cost || 0),
    warranty_expiry: b.warranty_expiry || null,
    status: b.status || 'operational',
    specifications: b.specifications || {},
  };
  if (typeof f.specifications === 'string') {
    try { f.specifications = f.specifications.trim() ? JSON.parse(f.specifications) : {}; }
    catch { throw new HttpError(400, 'Specifications must be valid JSON, e.g. {"ram_gb": 16}'); }
  }
  if (!f.asset_tag || !f.equipment_name || !f.category_id || !f.lab_id || !f.purchase_date) {
    throw new HttpError(400, 'Asset tag, name, category, lab and purchase date are required');
  }
  return f;
}

