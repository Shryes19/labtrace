'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/components/useApi';

export default function EquipmentForm({ lookups, initial }) {
  const router = useRouter();
  const api = useApi();
  const d = (v) => (v ? String(v).slice(0, 10) : '');
  const [f, setF] = useState(initial ? {
    ...initial, purchase_date: d(initial.purchase_date), warranty_expiry: d(initial.warranty_expiry),
    specifications: JSON.stringify(initial.specifications || {}, null, 2),
  } : { asset_tag: '', equipment_name: '', category_id: '', lab_id: '', manufacturer: '', model_no: '', serial_no: '',
        purchase_date: '', purchase_cost: '', warranty_expiry: '', status: 'operational', specifications: '{\n  \n}' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const url = initial ? `/api/equipment/${initial.equipment_id}` : '/api/equipment';
    const r = await api.call(url, { method: initial ? 'PUT' : 'POST', body: f, refresh: false });
    if (r) router.push(`/equipment/${initial ? initial.equipment_id : r.equipment_id}`);
  }
  async function remove() {
    if (!confirm('Delete this equipment? Only possible if it has no incidents.')) return;
    const r = await api.call(`/api/equipment/${initial.equipment_id}`, { method: 'DELETE', refresh: false });
    if (r) router.push('/equipment');
  }
  return (
    <form className="card" onSubmit={save}>
      {api.error && <div className="alert error">{api.error}</div>}
      <div className="row">
        <div className="field"><label>Asset tag *</label><input value={f.asset_tag} onChange={set('asset_tag')} required /></div>
        <div className="field"><label>Name *</label><input value={f.equipment_name} onChange={set('equipment_name')} required /></div>
      </div>
      <div className="row">
        <div className="field"><label>Category *</label><select value={f.category_id} onChange={set('category_id')} required><option value="">Select…</option>
          {lookups.categories.map((c) => <option key={c.category_id} value={c.category_id}>{'  '.repeat(c.depth)}{c.category_name}</option>)}</select></div>
        <div className="field"><label>Laboratory *</label><select value={f.lab_id} onChange={set('lab_id')} required><option value="">Select…</option>
          {lookups.labs.map((l) => <option key={l.lab_id} value={l.lab_id}>{l.lab_code} - {l.lab_name}</option>)}</select></div>
        <div className="field"><label>Status</label><select value={f.status} onChange={set('status')}>
          {['operational', 'faulty', 'under_maintenance', 'retired'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
      </div>
      <div className="row">
        <div className="field"><label>Manufacturer</label><input value={f.manufacturer || ''} onChange={set('manufacturer')} /></div>
        <div className="field"><label>Model</label><input value={f.model_no || ''} onChange={set('model_no')} /></div>
        <div className="field"><label>Serial no.</label><input value={f.serial_no || ''} onChange={set('serial_no')} /></div>
      </div>
      <div className="row">
        <div className="field"><label>Purchase date *</label><input type="date" value={f.purchase_date} onChange={set('purchase_date')} required /></div>
        <div className="field"><label>Purchase cost (₹)</label><input type="number" min={0} value={f.purchase_cost} onChange={set('purchase_cost')} /></div>
        <div className="field"><label>Warranty expiry</label><input type="date" value={f.warranty_expiry} onChange={set('warranty_expiry')} /></div>
      </div>
      <div className="field"><label>Specifications (JSON - stored as JSONB)</label><textarea className="mono" rows={5} value={f.specifications} onChange={set('specifications')} /></div>
      <div className="row" style={{ flex: 0 }}>
        <button className="btn" style={{ flex: 0 }} disabled={api.busy}>{api.busy ? 'Saving…' : 'Save'}</button>
        {initial && <button type="button" className="btn danger" style={{ flex: 0 }} onClick={remove} disabled={api.busy}>Delete</button>}
      </div>
    </form>
  );
}
