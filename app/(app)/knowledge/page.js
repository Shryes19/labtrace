import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { listArticles, kbStats, safely } from '@/lib/knowledge';
import { fmtDate } from '@/components/format';
import KnowledgeSearch from './KnowledgeSearch';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage({ searchParams }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const [articles, stats] = await Promise.all([safely(() => listArticles(), null), safely(() => kbStats(), null)]);
  return (
    <>
      <div className="page-head">
        <div><h1>Knowledge base</h1>
          <div className="sub">Historical failures, diagnoses and repair guides stored in MongoDB. Search by meaning, not just keywords.</div></div>
        {user.role !== 'student' && <Link className="btn" href="/knowledge/new">+ New article</Link>}
      </div>
      {!stats && <div className="alert error">MongoDB knowledge base is not reachable. Check MONGODB_URI and run <code>npm run kb:sync</code>.</div>}
      {stats && (
        <div className="grid g4">
          <div className="card stat"><div className="label">Incident documents</div><div className="value">{stats.incidents}</div><div className="hint">{stats.resolved} with a documented fix</div></div>
          <div className="card stat"><div className="label">Articles</div><div className="value">{stats.articles}</div><div className="hint">guides & SOPs</div></div>
          <div className="card stat" style={{ gridColumn: 'span 2' }}><div className="label">Vector search engine</div><div className="value" style={{ fontSize: 18 }}>{stats.vectorMode}</div>
            <div className="hint">384-dimension embeddings · cosine similarity</div></div>
        </div>)}
      <div className="spacer" />
      <KnowledgeSearch initialQuery={sp.q || ''} role={user.role} />
      <div className="card">
        <div className="card-head"><h2>Articles</h2></div>
        {articles?.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Title</th><th>Category</th><th>Tags</th><th>Author</th><th className="num">Views</th><th>Updated</th></tr></thead>
            <tbody>{articles.map((a) => (
              <tr key={a._id}>
                <td><Link className="cell-title" href={`/knowledge/${a._id}`}>{a.title}</Link></td>
                <td>{a.category}</td>
                <td>{(a.tags || []).slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}</td>
                <td>{a.author?.name}</td>
                <td className="num">{a.views || 0}</td>
                <td className="muted">{fmtDate(a.updated_at, false)}</td>
              </tr>))}</tbody></table></div>
        ) : <div className="empty">No articles yet.</div>}
      </div>
    </>
  );
}
