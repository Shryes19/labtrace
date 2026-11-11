'use client';
import { useState } from 'react';
import { useApi } from '@/components/useApi';

export default function LabForm() {
  const api = useApi();
  const empty = { lab_code: '', lab_name: '', building: '', floor_no: 0, room_no: '', capacity: 30 };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (await api.call('/api/labs', { body: f, success: 'Laboratory added.' })) setF(empty);
  }
  return (
    <form className="card" onSubmit={save}>
      <h2>Add laboratory</h2>
      {api.error && <div className="alert error">{api.error}</div>}
      {api.message && <div className="alert ok">{api.message}</div>}
      <div className="row">
        <div className="field"><label>Code</label><input value={f.lab_code} onChange={set('lab_code')} required /></div>
        <div className="field"><label>Name</label><input value={f.lab_name} onChange={set('lab_name')} required /></div>
        <div className="field"><label>Building</label><input value={f.building} onChange={set('building')} required /></div>
        <div className="field"><label>Floor</label><input type="number" value={f.floor_no} onChange={set('floor_no')} /></div>
        <div className="field"><label>Room</label><input value={f.room_no} onChange={set('room_no')} required /></div>
        <div className="field"><label>Capacity</label><input type="number" min={1} value={f.capacity} onChange={set('capacity')} /></div>
      </div>
      <button className="btn" disabled={api.busy}>Add lab</button>
    </form>
  );
}
