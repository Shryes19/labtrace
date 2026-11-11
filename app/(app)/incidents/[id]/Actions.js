'use client';
import { useState } from 'react';
import { useApi } from '@/components/useApi';
import { fmtDate } from '@/components/format';

function Feedback({ api }) {
  return (
    <>
      {api.error && <div className="alert error">{api.error}</div>}
      {api.message && <div className="alert ok">{api.message}</div>}
    </>
  );
}

// ------------------------------------------------------------ admin: assign
export function AssignPanel({ incidentId, techs, current }) {
  const api = useApi();
  const [tech, setTech] = useState('');
  const [notes, setNotes] = useState('');
  async function assign(e) {
    e.preventDefault();
    await api.call(`/api/incidents/${incidentId}/assign`, {
      body: { technician_id: tech || null, notes }, success: tech ? 'Technician assigned.' : 'Assigned automatically by sp_assign_technician.',
    });
  }
  return (
    <form className="card" onSubmit={assign}>
      <h2>{current ? 'Re-assign technician' : 'Assign technician'}</h2>
      <Feedback api={api} />
      <div className="row">
        <div className="field"><label>Technician</label>
          <select value={tech} onChange={(e) => setTech(e.target.value)}>
            <option value="">Auto - best skill match, least workload (stored procedure)</option>
            {techs.map((t) => (
              <option key={t.technician_id} value={t.technician_id} disabled={t.technician_id === current}>
                {t.full_name} · skill {t.skill_level ?? '-'} · {t.active_jobs} active job(s){t.technician_id === current ? ' (current)' : ''}
              </option>))}
          </select></div>
        <div className="field"><label>Note for technician</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" /></div>
      </div>
      <button className="btn" disabled={api.busy}>{api.busy ? 'Assigning…' : 'Assign'}</button>
    </form>
  );
}

// ------------------------------------------------------------ technician: work + repair record
const ROOT_CAUSES = ['Thermal / cooling', 'Power supply', 'Memory (RAM)', 'Storage', 'GPU / driver', 'Software / OS', 'Peripherals',
  'Motherboard', 'Network hardware', 'Network configuration', 'Display', 'Battery', 'Lamp / optics', 'Accessories',
  'Calibration', 'Electrical', 'Fabrication', 'User error', 'Other'];

export function TechnicianPanel({ inc, parts }) {
  const api = useApi();
  const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState({ diagnosis: '', root_cause: '', action_taken: '', outcome: 'fixed', started_at: toLocal(new Date(Date.now() - 3600e3)) });
  const [used, setUsed] = useState([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function start() {
    await api.call(`/api/incidents/${inc.incident_id}/status`, { method: 'PATCH', body: { status: 'in_progress', remark: 'Work started' }, success: 'Marked as in progress.' });
  }
  async function submit(e) {
    e.preventDefault();
    const ok = await api.call(`/api/incidents/${inc.incident_id}/maintenance`, {
      body: { ...f, started_at: new Date(f.started_at).toISOString(), parts: used }, success: 'Maintenance recorded. Stock updated and knowledge base refreshed.',
    });
    if (ok) setUsed([]);
  }
  if (!['assigned', 'in_progress', 'reopened'].includes(inc.status)) return null;
  return (
    <div className="card">
      <div className="card-head">
        <h2>Record repair work</h2>
        {inc.status !== 'in_progress' && <button className="btn secondary small" onClick={start} disabled={api.busy}>Start work</button>}
      </div>
      <Feedback api={api} />
      <form onSubmit={submit}>
        <div className="field"><label>Diagnosis *</label><textarea rows={3} value={f.diagnosis} onChange={set('diagnosis')} required placeholder="What did you find?" /></div>
        <div className="row">
          <div className="field"><label>Root cause</label>
            <select value={f.root_cause} onChange={set('root_cause')}><option value="">Select…</option>{ROOT_CAUSES.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="field"><label>Outcome</label>
            <select value={f.outcome} onChange={set('outcome')}>
              <option value="fixed">Fixed</option><option value="replaced">Component replaced</option>
              <option value="partial">Partially fixed (keep open)</option><option value="not_fixed">Not fixed (keep open)</option>
            </select></div>
          <div className="field"><label>Work started at</label><input type="datetime-local" value={f.started_at} onChange={set('started_at')} /></div>
        </div>
        <div className="field"><label>Action taken *</label><textarea rows={3} value={f.action_taken} onChange={set('action_taken')} required placeholder="Steps you performed to fix it" /></div>
        <label>Spare parts used</label>
        {used.map((u, i) => (
          <div className="row" key={i} style={{ marginBottom: 8 }}>
            <select value={u.part_id} onChange={(e) => setUsed(used.map((x, j) => (j === i ? { ...x, part_id: e.target.value } : x)))}>
              <option value="">Select part…</option>
              {parts.map((p) => <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.qty_in_stock} in stock)</option>)}
            </select>
            <input type="number" min={1} value={u.quantity} style={{ maxWidth: 90, flex: 0 }}
              onChange={(e) => setUsed(used.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            <button type="button" className="btn secondary small" style={{ flex: 0 }} onClick={() => setUsed(used.filter((_, j) => j !== i))}>Remove</button>
          </div>))}
        <div style={{ marginBottom: 14 }}>
          <button type="button" className="btn secondary small" onClick={() => setUsed([...used, { part_id: '', quantity: 1 }])}>+ Add part</button>
        </div>
        <button className="btn" disabled={api.busy}>{api.busy ? 'Saving…' : 'Save maintenance record'}</button>
        <p className="muted small">Saved through stored procedure <code>sp_complete_maintenance</code> - the record, the parts (stock trigger) and the status change are one transaction.</p>
      </form>
    </div>
  );
}

// ------------------------------------------------------------ reporter: confirm / reopen
export function ReporterPanel({ inc }) {
  const api = useApi();
  const [remark, setRemark] = useState('');
  const change = (status, success) => api.call(`/api/incidents/${inc.incident_id}/status`, { method: 'PATCH', body: { status, remark }, success });
  return (
    <div className="card">
      <h2>{inc.status === 'resolved' ? 'Is the problem fixed?' : 'Problem came back?'}</h2>
      <Feedback api={api} />
      <div className="field"><label>Comment (optional)</label><input value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
      <div className="row" style={{ flex: 0 }}>
        {inc.status === 'resolved' && <button className="btn" style={{ flex: 0 }} disabled={api.busy} onClick={() => change('closed', 'Thanks! Incident closed.')}>Yes, close it</button>}
        <button className="btn secondary" style={{ flex: 0 }} disabled={api.busy} onClick={() => change('reopened', 'Incident reopened.')}>Still not working - reopen</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ admin: other status actions
const ADMIN_ACTIONS = {
  open: [['closed', 'Cancel (close as invalid)']],
  resolved: [['closed', 'Close'], ['reopened', 'Reopen']],
  reopened: [['closed', 'Close']],
  closed: [['reopened', 'Reopen']],
};
export function AdminStatusPanel({ inc }) {
  const api = useApi();
  const [remark, setRemark] = useState('');
  const actions = ADMIN_ACTIONS[inc.status] || [];
  if (!actions.length) return null;
  return (
    <div className="card">
      <h2>Administrator actions</h2>
      <Feedback api={api} />
      <div className="row">
        <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark for status log (optional)" />
        {actions.map(([s, label]) => (
          <button key={s} className="btn secondary" style={{ flex: 0 }} disabled={api.busy}
            onClick={() => api.call(`/api/incidents/${inc.incident_id}/status`, { method: 'PATCH', body: { status: s, remark }, success: 'Status updated.' })}>
            {label}
          </button>))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ notes (MongoDB array)
export function NotesPanel({ incidentId, notes, available }) {
  const api = useApi();
  const [text, setText] = useState('');
  async function add(e) {
    e.preventDefault();
    if (await api.call(`/api/incidents/${incidentId}/notes`, { body: { text } })) setText('');
  }
  return (
    <div className="card">
      <h2>Discussion notes</h2>
      <p className="muted small" style={{ marginTop: -6 }}>Stored in the incident&apos;s MongoDB document (flexible, schema-less).</p>
      {!available && <div className="alert info">Knowledge base document not available.</div>}
      {notes.map((n, i) => (
        <div key={i} className="result">
          <div className="result-head"><b>{n.author} <span className="muted small">({n.role})</span></b><span className="muted small">{fmtDate(n.at)}</span></div>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.text}</div>
        </div>))}
      {available && (
        <form onSubmit={add}>
          {api.error && <div className="alert error">{api.error}</div>}
          <div className="field"><textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" required /></div>
          <button className="btn secondary small" disabled={api.busy}>Add note</button>
        </form>)}
    </div>
  );
}

// ------------------------------------------------------------ KB document admin (tags / delete)
export function KnowledgeAdmin({ incidentId, tags, role }) {
  const api = useApi();
  const [value, setValue] = useState(tags.join(', '));
  return (
    <div className="card">
      <h2>Knowledge base entry</h2>
      <Feedback api={api} />
      <div className="field"><label>Tags (comma separated)</label><input value={value} onChange={(e) => setValue(e.target.value)} /></div>
      <div className="row" style={{ flex: 0 }}>
        <button className="btn secondary small" style={{ flex: 0 }} disabled={api.busy}
          onClick={() => api.call(`/api/incidents/${incidentId}/tags`, { method: 'PUT', body: { tags: value.split(',') }, success: 'Tags updated.' })}>Save tags</button>
        {role === 'admin' && (
          <button className="btn danger small" style={{ flex: 0 }} disabled={api.busy}
            onClick={() => confirm('Remove this incident from the knowledge base? (The PostgreSQL record is kept.)') &&
              api.call(`/api/knowledge/incidents/${incidentId}`, { method: 'DELETE', success: 'Removed from knowledge base.' })}>
            Remove from KB
          </button>)}
      </div>
    </div>
  );
}
