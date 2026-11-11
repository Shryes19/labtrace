import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { listIncidents, lookups } from '@/lib/queries';
import { StatusBadge, SeverityBadge } from '@/components/Badges';
import { ago } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function IncidentsPage({ searchParams }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { rows, labs } = await withUser(user, async (c) => ({
    rows: await listIncidents(c, { ...sp, mine: sp.mine === '1', userId: user.id, limit: 200 }),
    labs: (await lookups(c)).labs,
  }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{user.role === 'student' ? 'My incidents' : sp.mine ? 'My jobs' : 'Incidents'}</h1>
          <div className="sub">{rows.length} incident(s){user.role === 'student' && ' - you can only see incidents you reported (enforced by row-level security)'}</div>
        </div>
        <Link className="btn" href="/incidents/new">+ Report a failure</Link>
      </div>
      <form className="filters">
        <div><label>Search</label><input name="q" defaultValue={sp.q || ''} placeholder="title, description, asset tag" /></div>
        <div><label>Status</label>
          <select name="status" defaultValue={sp.status || ''}>
            <option value="">All</option><option value="active">Active (not resolved)</option>
            {['open', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select></div>
        <div><label>Severity</label>
          <select name="severity" defaultValue={sp.severity || ''}>
            <option value="">All</option>{['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div><label>Lab</label>
          <select name="lab" defaultValue={sp.lab || ''}>
            <option value="">All labs</option>{labs.map((l) => <option key={l.lab_id} value={l.lab_id}>{l.lab_code}</option>)}
          </select></div>
        {user.role === 'technician' && <input type="hidden" name="mine" value={sp.mine || ''} />}
        <button className="btn secondary">Apply</button>
      </form>
      <div className="card">
        {rows.length === 0 ? <div className="empty">No incidents match these filters.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>ID</th><th>Problem</th><th>Equipment</th><th>Severity</th><th>Status</th><th>Technician</th><th>Reported</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.incident_id}>
                <td className="mono">INC-{r.incident_id}</td>
                <td><Link className="cell-title" href={`/incidents/${r.incident_id}`}>{r.title}</Link>
                  <div className="cell-sub">{r.description.slice(0, 90)}{r.description.length > 90 && '…'}</div></td>
                <td>{r.asset_tag}<div className="cell-sub">{r.category_name} · {r.lab_code}</div></td>
                <td><SeverityBadge value={r.severity} /></td>
                <td><StatusBadge value={r.status} /></td>
                <td>{r.technician_name || <span className="muted">-</span>}</td>
                <td className="muted">{ago(r.reported_at)}<div className="cell-sub">by {r.reporter_name}</div></td>
              </tr>))}
            </tbody>
          </table></div>)}
      </div>
    </>
  );
}
