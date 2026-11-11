import Link from 'next/link';

export function Score({ score }) {
  const pct = Math.max(0, Math.round(score * 100));
  return (
    <div style={{ minWidth: 70, textAlign: 'right' }}>
      <span className="score">{pct}% match</span>
      <div className="scorebar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function SimilarList({ data, role }) {
  const { incidents = [], articles = [] } = data;
  if (!incidents.length && !articles.length) return <p className="muted small">No similar items found.</p>;
  return (
    <>
      {incidents.map((r) => (
        <div className="result" key={r._id}>
          <div className="result-head">
            <div>
              {role === 'student'
                ? <span className="cell-title">{r.title}</span>
                : <Link className="cell-title" href={`/incidents/${r.incident_id}`}>INC-{r.incident_id} · {r.title}</Link>}
              <div className="cell-sub">{r.equipment?.asset_tag} · {r.equipment?.category} · {r.status}</div>
            </div>
            <Score score={r.score} />
          </div>
          <p className="small" style={{ margin: '6px 0 0' }}>&ldquo;{r.description}&rdquo;</p>
          {role !== 'student' && r.resolution && (
            <p className="small" style={{ margin: '6px 0 0' }}><b>Fix:</b> {r.resolution}</p>
          )}
        </div>
      ))}
      {articles.length > 0 && <h3 style={{ marginTop: 14 }}>Help articles</h3>}
      {articles.map((a) => (
        <div className="result" key={a._id}>
          <div className="result-head">
            <Link className="cell-title" href={`/knowledge/${a._id}`}>{a.title}</Link>
            <Score score={a.score} />
          </div>
        </div>
      ))}
    </>
  );
}
