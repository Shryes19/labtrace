'use client';
import { useState } from 'react';
import { useApi } from '@/components/useApi';

export function RestockButton({ partId }) {
  const api = useApi();
  const [qty, setQty] = useState(5);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 64 }} />
      <button className="btn secondary small" disabled={api.busy}
        onClick={() => api.call(`/api/parts/${partId}/restock`, { body: { quantity: Number(qty) } })}>Restock</button>
      {api.error && <span className="small" style={{ color: 'var(--bad)' }}>{api.error}</span>}
    </div>
  );
}

export function PartForm() {
  const api = useApi();
  const empty = { part_no: '', part_name: '', part_category: '', unit_cost: '', qty_in_stock: 0, reorder_level: 2 };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await api.call('/api/parts', { body: f, success: 'Part added.' })) setF(empty); }}>
      <h2>Add spare part</h2>
      {api.error && <div className="alert error">{api.error}</div>}
      {api.message && <div className="alert ok">{api.message}</div>}
      <div className="row">
        <div className="field"><label>Part no.</label><input value={f.part_no} onChange={set('part_no')} required /></div>
        <div className="field"><label>Name</label><input value={f.part_name} onChange={set('part_name')} required /></div>
        <div className="field"><label>Category</label><input value={f.part_category} onChange={set('part_category')} required /></div>
        <div className="field"><label>Unit cost (₹)</label><input type="number" min={0} value={f.unit_cost} onChange={set('unit_cost')} required /></div>
        <div className="field"><label>Stock</label><input type="number" min={0} value={f.qty_in_stock} onChange={set('qty_in_stock')} /></div>
        <div className="field"><label>Reorder level</label><input type="number" min={0} value={f.reorder_level} onChange={set('reorder_level')} /></div>
      </div>
      <button className="btn" disabled={api.busy}>Add part</button>
    </form>
  );
}
