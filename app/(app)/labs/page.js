import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import LabForm from './LabForm';

export const dynamic = 'force-dynamic';

export default async function LabsPage() {
  const user = await requirePageUser();
  const labs = await withUser(user, async (c) => (await c.query(
    `SELECT l.*, u.full_name AS incharge_name,
            COUNT(e.equipment_id) AS assets,
            COUNT(e.equipment_id) FILTER (WHERE e.status IN ('faulty','under_maintenance')) AS down
       FROM labs l LEFT JOIN users u ON u.user_id = l.incharge_id
       LEFT JOIN equipment e ON e.lab_id = l.lab_id
      GROUP BY l.lab_id, u.full_name ORDER BY l.lab_code`)).rows);
  return (
    <>
      <div className="page-head"><div><h1>Laboratories</h1><div className="sub">{labs.length} laboratories</div></div></div>
      <div className="grid g3">
        {labs.map((l) => (
          <div className="card" key={l.lab_id}>
            <div className="card-head"><h2>{l.lab_name}</h2><span className="tag">{l.lab_code}</span></div>
            <dl className="kv">
              <dt>Location</dt><dd>{l.building}, floor {l.floor_no}, room {l.room_no}</dd>
              <dt>Capacity</dt><dd>{l.capacity} seats</dd>
              <dt>In-charge</dt><dd>{l.incharge_name || '-'}</dd>
              <dt>Assets</dt><dd>{l.assets} ({l.down > 0 ? <span style={{ color: 'var(--bad)' }}>{l.down} down</span> : 'all working'})</dd>
            </dl>
            <div style={{ marginTop: 12 }}><Link href={`/equipment?lab=${l.lab_id}`}>View equipment →</Link></div>
          </div>))}
      </div>
      {user.role === 'admin' && <><div className="spacer" /><LabForm /></>}
    </>
  );
}
