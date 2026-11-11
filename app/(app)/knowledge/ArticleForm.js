'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/components/useApi';

export default function ArticleForm({ initial, canDelete }) {
  const router = useRouter();
  const api = useApi();
  const [f, setF] = useState(initial
    ? { title: initial.title, body: initial.body, category: initial.category, tags: (initial.tags || []).join(', ') }
    : { title: '', body: '', category: 'General', tags: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const r = initial
      ? await api.call(`/api/knowledge/articles/${initial._id}`, { method: 'PATCH', body: f, refresh: false })
      : await api.call('/api/knowledge/articles', { body: f, refresh: false });
    if (r) { router.push(`/knowledge/${initial ? initial._id : r.id}`); router.refresh(); }
  }
  async function remove() {
    if (!confirm('Delete this article permanently?')) return;
    if (await api.call(`/api/knowledge/articles/${initial._id}`, { method: 'DELETE', refresh: false })) { router.push('/knowledge'); router.refresh(); }
  }
  return (
    <form className="card" onSubmit={save}>
      {api.error && <div className="alert error">{api.error}</div>}
      <div className="field"><label>Title</label><input value={f.title} onChange={set('title')} required minLength={5} /></div>
      <div className="row">
        <div className="field"><label>Category</label><input value={f.category} onChange={set('category')} /></div>
        <div className="field"><label>Tags (comma separated)</label><input value={f.tags} onChange={set('tags')} /></div>
      </div>
      <div className="field"><label>Content</label><textarea rows={14} value={f.body} onChange={set('body')} required minLength={20} /></div>
      <div className="row" style={{ flex: 0 }}>
        <button className="btn" style={{ flex: 0 }} disabled={api.busy}>{api.busy ? 'Saving…' : 'Save article'}</button>
        {canDelete && <button type="button" className="btn danger" style={{ flex: 0 }} onClick={remove} disabled={api.busy}>Delete</button>}
      </div>
      <p className="muted small">On save, the text is converted into a 384-dimension embedding so the article can be found by meaning.</p>
    </form>
  );
}
