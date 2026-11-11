'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Score } from '@/components/SimilarList';

const EXAMPLES = ['computer gets too hot and turns off', 'thermal shutdown', 'no internet in lab', 'projector screen too dark', 'gpu missing after reboot'];

export default function KnowledgeSearch({ initialQuery, role }) {
  const [q, setQ] = useState(initialQuery);
  const [mode, setMode] = useState('semantic');
  const [scope, setScope] = useState('all');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(query = q, m = mode, s = scope) {
    if (!query.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&mode=${m}&scope=${s}&k=8`);
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    setRes(r.ok ? data : { error: data.error || 'Search failed' });
  }
  useEffect(() => { if (initialQuery) run(initialQuery); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="filters" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 260 }}><label>Describe a problem</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. computer gets too hot and turns off" /></div>
        <div><label>Mode</label>
          <div className="seg">
            {['semantic', 'keyword'].map((m) => (
              <button type="button" key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); run(q, m, scope); }}>{m === 'semantic' ? 'Semantic (vector)' : 'Keyword'}</button>))}
          </div></div>
        <div><label>Search in</label>
          <select value={scope} onChange={(e) => { setScope(e.target.value); run(q, mode, e.target.value); }}>
            <option value="all">Everything</option><option value="incidents">Past incidents</option><option value="articles">Articles</option>
          </select></div>
        <button className="btn" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <div className="small muted" style={{ marginBottom: 12 }}>Try: {EXAMPLES.map((ex) => (
        <button key={ex} type="button" className="tag" style={{ border: 0, cursor: 'pointer' }} onClick={() => { setQ(ex); run(ex); }}>{ex}</button>))}</div>
      {res?.error && <div className="alert error">{res.error}</div>}
      {res && !res.error && (
        <>
          <div className="muted small" style={{ marginBottom: 8 }}>{res.results.length} result(s) · {res.mode === 'semantic' ? 'ranked by cosine similarity of embeddings' : 'case-insensitive text match'}</div>
          {res.results.map((r) => (
            <div className="result" key={`${r.kind}-${r._id}`}>
              <div className="result-head">
                <div>
                  <span className="tag">{r.kind === 'incidents' ? 'Past incident' : 'Article'}</span>{' '}
                  {r.kind === 'articles' ? <Link className="cell-title" href={`/knowledge/${r._id}`}>{r.title}</Link>
                    : role === 'student' ? <span className="cell-title">{r.title}</span>
                    : <Link className="cell-title" href={`/incidents/${r.incident_id}`}>INC-{r.incident_id} · {r.title}</Link>}
                  {r.kind === 'incidents' && <div className="cell-sub">{r.equipment?.asset_tag} · {r.equipment?.category} · {r.status}</div>}
                </div>
                {res.mode === 'semantic' && <Score score={r.score} />}
              </div>
              {r.kind === 'incidents' ? (
                <>
                  <p className="small" style={{ margin: '6px 0 0' }}>&ldquo;{r.description}&rdquo;</p>
                  {role !== 'student' && r.diagnosis && <p className="small" style={{ margin: '4px 0 0' }}><b>Diagnosis:</b> {r.diagnosis}</p>}
                  {role !== 'student' && r.resolution && <p className="small" style={{ margin: '4px 0 0' }}><b>Fix:</b> {r.resolution}</p>}
                </>
              ) : <p className="small" style={{ margin: '6px 0 0' }}>{r.body?.slice(0, 220)}…</p>}
            </div>))}
          {res.results.length === 0 && <div className="empty">No matches{res.mode === 'keyword' ? ' - try Semantic mode, it understands different wording.' : '.'}</div>}
        </>)}
    </div>
  );
}
