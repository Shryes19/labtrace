'use client';
import { useApi } from '@/components/useApi';

export default function ReindexButton() {
  const api = useApi();
  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn secondary" disabled={api.busy}
        onClick={async () => {
          const r = await api.call('/api/knowledge/reindex', { refresh: false });
          if (r) api.setMessage(`Re-indexed ${r.incidents_indexed} incidents into MongoDB.`);
        }}>
        {api.busy ? 'Re-indexing…' : 'Rebuild knowledge base'}
      </button>
      {api.error && <div className="small" style={{ color: 'var(--bad)' }}>{api.error}</div>}
      {api.message && <div className="small" style={{ color: 'var(--good)' }}>{api.message}</div>}
    </div>
  );
}
