'use client';
import { useState } from 'react';
import { useApi } from '@/components/useApi';

export function UserRowActions({ u, self }) {
  const api = useApi();
  if (self) return <span className="muted small">you</span>;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select defaultValue={u.role} style={{ width: 120 }} disabled={api.busy}
        onChange={(e) => api.call(`/api/users/${u.user_id}`, { method: 'PATCH', body: { role: e.target.value } })}>
        <option value="student">student</option><option value="technician">technician</option><option value="admin">admin</option>
      </select>
      <button className="btn secondary small" disabled={api.busy}
        onClick={() => api.call(`/api/users/${u.user_id}`, { method: 'PATCH', body: { is_active: !u.is_active } })}>
        {u.is_active ? 'Deactivate' : 'Activate'}
      </button>
      {api.error && <span className="small" style={{ color: 'var(--bad)' }}>{api.error}</span>}
    </div>
  );
}

export function NewUserForm({ categories }) {
  const api = useApi();
  const empty = { institution_id: '', full_name: '', email: '', password: '', role: 'technician', department: 'Lab Maintenance', skills: [] };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await api.call('/api/users', { body: f, success: 'User created.' })) setF(empty); }}>
      <h2>Create account</h2>
      {api.error && <div className="alert error">{api.error}</div>}
      {api.message && <div className="alert ok">{api.message}</div>}
      <div className="row">
        <div className="field"><label>Employee ID / SRN</label><input value={f.institution_id} onChange={set('institution_id')} required /></div>
        <div className="field"><label>Full name</label><input value={f.full_name} onChange={set('full_name')} required /></div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} required /></div>
      </div>
      <div className="row">
        <div className="field"><label>Role</label><select value={f.role} onChange={set('role')}>
          <option value="technician">technician</option><option value="admin">admin</option><option value="student">student</option></select></div>
        <div className="field"><label>Department</label><input value={f.department} onChange={set('department')} /></div>
        <div className="field"><label>Initial password</label><input type="password" value={f.password} onChange={set('password')} required minLength={8} /></div>
      </div>
      {f.role === 'technician' && (
        <div className="field"><label>Skills (hold Ctrl to select several)</label>
          <select multiple size={6} value={f.skills} onChange={(e) => setF({ ...f, skills: [...e.target.selectedOptions].map((o) => o.value) })}>
            {categories.map((c) => <option key={c.category_id} value={c.category_id}>{'  '.repeat(c.depth)}{c.category_name}</option>)}
          </select></div>)}
      <button className="btn" disabled={api.busy}>Create</button>
    </form>
  );
}
