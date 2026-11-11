import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { getArticle, semanticSearch, safely } from '@/lib/knowledge';
import { fmtDate } from '@/components/format';
import ArticleForm from '../ArticleForm';
import { Score } from '@/components/SimilarList';

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params, searchParams }) {
  const user = await requirePageUser();
  const { id } = await params;
  const sp = await searchParams;
  const a = await safely(() => getArticle(id, { countView: !sp.edit }), null);
  if (!a) notFound();
  const canEdit = user.role !== 'student';
  const related = (await safely(() => semanticSearch(`${a.title}. ${a.body}`, { scope: 'articles', k: 4 }), []))
    .filter((r) => r._id !== a._id).slice(0, 3);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small"><Link href="/knowledge">Knowledge base</Link> / Article</div>
          <h1>{a.title}</h1>
          <div className="sub">{a.category} · by {a.author?.name} · updated {fmtDate(a.updated_at, false)} · {a.views || 0} views</div>
        </div>
        {canEdit && !sp.edit && <Link className="btn secondary" href={`/knowledge/${a._id}?edit=1`}>Edit</Link>}
      </div>
      {sp.edit && canEdit ? <ArticleForm initial={a} canDelete={user.role === 'admin'} /> : (
        <div className="grid g-main">
          <div className="card">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{a.body}</div>
            <div style={{ marginTop: 14 }}>{(a.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}</div>
          </div>
          <div className="card">
            <h2>Related articles</h2>
            {related.length ? related.map((r) => (
              <div className="result" key={r._id}>
                <div className="result-head"><Link className="cell-title" href={`/knowledge/${r._id}`}>{r.title}</Link><Score score={r.score} /></div>
              </div>)) : <div className="muted small">None found.</div>}
          </div>
        </div>)}
    </>
  );
}
