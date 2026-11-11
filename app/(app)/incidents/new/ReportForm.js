'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SimilarList from '@/components/SimilarList';

export default function ReportForm({ labs, equipment, role, preselect }) {
  const router = useRouter();
  const pre = equipment.find((e) => e.equipment_id === preselect);
  const [lab, setLab] = useState(pre ? String(pre.lab_id) : '');
  const [eq, setEq] = useState(pre ? String(pre.equipment_id) : '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [similar, setSimilar] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => equipment.filter((e) => !lab || String(e.lab_id) === lab), [equipment, lab]);
  const text = `${title}. ${desc}`.trim();

  // debounce: semantic search 600 ms after the user stops typing
  useEffect(() => {
    if (desc.trim().length < 12) { setSimilar(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch('/api/knowledge/similar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      setSearching(false);
      setSimilar(res.ok ? data : { error: data?.error || 'Knowledge base unavailable' });
    }, 600);
    return () => clearTimeout(t);
  }, [text, desc]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/incidents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment_id: eq, title, description: desc, severity }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Could not submit');
    router.push(`/incidents/${data.incident_id}?created=1`);
  }

  return (
    <div className="grid g-main">
      <form className="card" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="row">
          <div className="field"><label>Laboratory</label>
            <select value={lab} onChange={(e) => { setLab(e.target.value); setEq(''); }}>
              <option value="">All labs</option>
              {labs.map((l) => <option key={l.lab_id} value={l.lab_id}>{l.lab_code} - {l.lab_name}</option>)}
            </select></div>
          <div className="field"><label>Equipment *</label>
            <select value={eq} onChange={(e) => setEq(e.target.value)} required>
              <option value="">Select equipment…</option>
              {options.map((e) => <option key={e.equipment_id} value={e.equipment_id}>{e.asset_tag} - {e.equipment_name} ({e.category_name})</option>)}
            </select></div>
        </div>
        <div className="field"><label>Short title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PC switches off during compilation" required minLength={5} maxLength={150} /></div>
        <div className="field"><label>What is happening? *</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={6} required minLength={10}
            placeholder="Describe the problem in your own words - when it happens, what you see or hear, any error messages." /></div>
        <div className="field" style={{ maxWidth: 260 }}><label>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">Low - minor inconvenience</option>
            <option value="medium">Medium - partly usable</option>
            <option value="high">High - cannot be used</option>
            <option value="critical">Critical - safety risk / lab blocked</option>
          </select></div>
        <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
      </form>
      <div className="card">
        <div className="card-head"><h2>Similar past failures</h2>{searching && <span className="muted small">searching…</span>}</div>
        {!similar && <p className="muted small">Start describing the problem - matching resolved incidents and help articles appear here, even if they use different words.</p>}
        {similar?.error && <div className="alert info">{similar.error}</div>}
        {similar && !similar.error && <SimilarList data={similar} role={role} />}
      </div>
    </div>
  );
}
