import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { dashboardCounts, equipmentStatusCounts, listIncidents } from '@/lib/queries';
import { StatusBadge, SeverityBadge, RiskBadge, ScoreMeter } from '@/components/Badges';
import { ago } from '@/components/format';

export const dynamic = 'force-dynamic';

function IncidentTable({ rows, showTech = true, empty }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Incident</th><th>Equipment</th><th>Severity</th><th>Status</th>{showTech && <th>Technician</th>}<th>Reported</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.incident_id}>
          <td><Link className="cell-title" href={`/incidents/${r.incident_id}`}>INC-{r.incident_id} · {r.title}</Link></td>
          <td>{r.asset_tag}<div className="cell-sub">{r.lab_code}</div></td>
          <td><SeverityBadge value={r.severity} /></td>
          <td><StatusBadge value={r.status} /></td>
          {showTech && <td>{r.technician_name || <span className="muted">Unassigned</span>}</td>}
          <td className="muted">{ago(r.reported_at)}</td>
        </tr>))}
      </tbody>
    </table></div>
  );
}

export default async function Dashboard({ searchParams }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const data = await withUser(user, async (c) => {
    const counts = await dashboardCounts(c);
    const eq = await equipmentStatusCounts(c);
    if (user.role === 'admin') {
      const unassigned = await listIncidents(c, { status: 'open', limit: 8 });
      const reopened = await listIncidents(c, { status: 'reopened', limit: 5 });
      const risky = (await c.query(`SELECT * FROM v_equipment_reliability ORDER BY reliability_score, total_failures DESC LIMIT 5`)).rows;
      const low = (await c.query('SELECT * FROM v_low_stock_parts ORDER BY qty_in_stock')).rows;
      return { counts, eq, unassigned: [...reopened, ...unassigned], risky, low };
    }
    if (user.role === 'technician') {
      const mine = await listIncidents(c, { status: 'active', mine: true, userId: user.id, limit: 20 });
      const recent = await listIncidents(c, { status: 'resolved', limit: 5 });
      return { counts, eq, mine, recent };
    }
    const mine = await listIncidents(c, { limit: 20 });
    return { counts, eq, mine };
  });
  const { counts, eq } = data;

  return (
    <>
      {sp?.denied && <div className="alert error">You do not have permission to open that page.</div>}
      <div className="page-head">
        <div>
          <h1>Welcome, {user.name.replace(/^(Dr|Prof)\.\s+/, '').split(' ')[0]}</h1>
          <div className="sub">
            {user.role === 'admin' && 'Institution-wide view of laboratory equipment health and maintenance.'}
            {user.role === 'technician' && 'Your assigned maintenance jobs and recent repairs.'}
            {user.role === 'student' && 'Report equipment problems and track their progress.'}
          </div>
        </div>
        <Link className="btn" href="/incidents/new">+ Report a failure</Link>
      </div>

      <div className="grid g4">
        <div className="card stat"><div className="label">{user.role === 'student' ? 'My open reports' : 'Open / reopened'}</div><div className="value">{counts.open}</div><div className="hint">waiting for a technician</div></div>
        <div className="card stat"><div className="label">In repair</div><div className="value">{counts.in_work}</div><div className="hint">assigned or in progress</div></div>
        <div className="card stat"><div className="label">Resolved</div><div className="value">{counts.resolved}</div><div className="hint">awaiting confirmation</div></div>
        <div className="card stat"><div className="label">Equipment down</div><div className="value">{(eq.faulty || 0) + (eq.under_maintenance || 0)}</div>
          <div className="hint">{eq.faulty || 0} faulty · {eq.under_maintenance || 0} in maintenance · {eq.operational || 0} OK</div></div>
      </div>
      <div className="spacer" />

      {user.role === 'admin' && (
        <div className="grid g-main">
          <div className="card">
            <div className="card-head"><h2>Needs assignment</h2><Link href="/incidents?status=open">View all</Link></div>
            <IncidentTable rows={data.unassigned} showTech={false} empty="Nothing waiting - all incidents are assigned." />
          </div>
          <div>
            <div className="card">
              <div className="card-head"><h2>Highest-risk assets</h2><Link href="/analytics">Analytics</Link></div>
              {data.risky.map((r) => (
                <div key={r.equipment_id} style={{ marginBottom: 12 }}>
                  <Link className="cell-title" href={`/equipment/${r.equipment_id}`}>{r.asset_tag}</Link> <RiskBadge value={r.risk_level} />
                  <div className="cell-sub">{r.equipment_name} · {r.total_failures} failures · {r.repeat_failures} repeat</div>
                  <ScoreMeter score={r.reliability_score} />
                </div>))}
            </div>
            <div className="card">
              <div className="card-head"><h2>Low stock</h2><Link href="/parts">Parts</Link></div>
              {data.low.length ? data.low.map((p) => (
                <div key={p.part_id} className="small" style={{ marginBottom: 6 }}>
                  <b>{p.part_name}</b> - {p.qty_in_stock} left (reorder at {p.reorder_level})
                </div>)) : <div className="muted small">All parts above reorder level.</div>}
            </div>
          </div>
        </div>
      )}

      {user.role === 'technician' && (
        <>
          <div className="card">
            <div className="card-head"><h2>My active jobs</h2><Link href="/incidents?mine=1">All my jobs</Link></div>
            <IncidentTable rows={data.mine} showTech={false} empty="No active jobs assigned to you." />
          </div>
          <div className="card">
            <div className="card-head"><h2>Recently resolved (all technicians)</h2></div>
            <IncidentTable rows={data.recent} empty="No recently resolved incidents." />
          </div>
        </>
      )}

      {user.role === 'student' && (
        <div className="card">
          <div className="card-head"><h2>My reports</h2></div>
          <IncidentTable rows={data.mine} empty="You have not reported any incidents yet." />
        </div>
      )}
    </>
  );
}
