import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { getEquipment, listIncidents, lookups } from '@/lib/queries';
import { EquipmentBadge, StatusBadge, SeverityBadge, RiskBadge, ScoreMeter } from '@/components/Badges';
import { fmtDate, inr } from '@/components/format';
import EquipmentForm from '../EquipmentForm';

export const dynamic = 'force-dynamic';

export default async function EquipmentDetail({ params, searchParams }) {
  const user = await requirePageUser();
  const { id } = await params;
  const sp = await searchParams;
  const data = await withUser(user, async (c) => {
    const e = await getEquipment(c, Number(id));
    if (!e) return null;
    const rel = user.role === 'student' ? null
      : (await c.query('SELECT * FROM v_equipment_reliability WHERE equipment_id = $1', [e.equipment_id])).rows[0];
    const history = (await c.query(
      `SELECT i.incident_id, i.title, i.severity, i.status, i.reported_at, i.resolved_at,
              m.root_cause, m.action_taken, m.labour_hours
         FROM incidents i LEFT JOIN maintenance_records m ON m.incident_id = i.incident_id
        WHERE i.equipment_id = $1 ORDER BY i.reported_at DESC`, [e.equipment_id])).rows;
    return { e, rel, history, lk: user.role === 'admin' ? await lookups(c) : null };
  });
  if (!data) notFound();
  const { e, rel, history, lk } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small"><Link href="/equipment">Equipment</Link> / {e.asset_tag}</div>
          <h1>{e.equipment_name}</h1>
          <div className="sub">{e.asset_tag} · {e.category_name} · {e.lab_code} ({e.building}, {e.room_no}) <EquipmentBadge value={e.status} /></div>
        </div>
        <div className="row" style={{ flex: 0 }}>
          {user.role === 'admin' && <Link className="btn secondary" href={`/equipment/${e.equipment_id}?edit=1`}>Edit</Link>}
          <Link className="btn" href={`/incidents/new?equipment=${e.equipment_id}`}>Report a failure</Link>
        </div>
      </div>

      {sp.edit && lk ? <EquipmentForm lookups={lk} initial={e} /> : (
        <div className="grid g-main">
          <div>
            <div className="card">
              <h2>Failure & repair history</h2>
              {user.role === 'student' && <p className="muted small">Students see only their own reports.</p>}
              {history.length === 0 ? <div className="muted">No failures recorded.</div> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Root cause / fix</th><th className="num">Hours</th></tr></thead>
                  <tbody>{history.map((h, i) => (
                    <tr key={i}>
                      <td><Link className="cell-title" href={`/incidents/${h.incident_id}`}>INC-{h.incident_id} · {h.title}</Link><div className="cell-sub">{fmtDate(h.reported_at, false)}</div></td>
                      <td><SeverityBadge value={h.severity} /></td><td><StatusBadge value={h.status} /></td>
                      <td>{h.root_cause || '-'}<div className="cell-sub">{h.action_taken}</div></td>
                      <td className="num">{h.labour_hours ?? '-'}</td>
                    </tr>))}</tbody></table></div>)}
            </div>
          </div>
          <div>
            {rel && (
              <div className="card">
                <div className="card-head"><h2>Predictive reliability</h2><RiskBadge value={rel.risk_level} /></div>
                <div style={{ marginBottom: 12 }}><ScoreMeter score={rel.reliability_score} /></div>
                <dl className="kv">
                  <dt>Total failures</dt><dd>{rel.total_failures} ({rel.failures_180d} in last 180 days)</dd>
                  <dt>Repeat failures</dt><dd>{rel.repeat_failures} <span className="muted small">(within 30 days of a repair)</span></dd>
                  <dt>MTBF</dt><dd>{rel.mtbf_hours ? `${Math.round(rel.mtbf_hours / 24)} days` : 'never failed'}</dd>
                  <dt>MTTR</dt><dd>{rel.mttr_hours ? `${rel.mttr_hours} h` : '-'}</dd>
                  <dt>Next failure (est.)</dt><dd>{rel.predicted_next_failure ? fmtDate(rel.predicted_next_failure, false) : '-'}</dd>
                  <dt>Parts spent</dt><dd>{inr(rel.parts_cost)}</dd>
                </dl>
                <p className="muted small">Computed in PostgreSQL by <code>fn_reliability_score()</code>, <code>fn_equipment_mtbf_hours()</code> and <code>fn_predicted_next_failure()</code>.</p>
              </div>)}
            <div className="card">
              <h2>Asset details</h2>
              <dl className="kv">
                <dt>Manufacturer</dt><dd>{e.manufacturer} {e.model_no}</dd>
                <dt>Serial no.</dt><dd className="mono">{e.serial_no}</dd>
                <dt>Purchased</dt><dd>{fmtDate(e.purchase_date, false)} · {inr(e.purchase_cost)}</dd>
                <dt>Warranty until</dt><dd>{e.warranty_expiry ? fmtDate(e.warranty_expiry, false) : '-'}
                  {e.warranty_expiry && new Date(e.warranty_expiry) < new Date() && <span className="muted"> (expired)</span>}</dd>
                <dt>Expected life</dt><dd>{e.expected_life_years} years</dd>
              </dl>
              <h3 style={{ marginTop: 14 }}>Specifications</h3>
              {Object.entries(e.specifications || {}).map(([k, v]) => <div key={k} className="small"><span className="muted">{k}:</span> {String(v)}</div>)}
            </div>
          </div>
        </div>)}
    </>
  );
}
