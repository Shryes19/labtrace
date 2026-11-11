import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { listEquipment, lookups } from '@/lib/queries';
import { EquipmentBadge } from '@/components/Badges';

export const dynamic = 'force-dynamic';

export default async function EquipmentPage({ searchParams }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { rows, lk } = await withUser(user, async (c) => ({ rows: await listEquipment(c, sp), lk: await lookups(c) }));
  return (
    <>
      <div className="page-head">
        <div><h1>Equipment</h1><div className="sub">{rows.length} asset(s). Category filter includes all sub-categories (recursive query).</div></div>
        {user.role === 'admin' && <Link className="btn" href="/equipment/new">+ Add equipment</Link>}
      </div>
      <form className="filters">
        <div><label>Search</label><input name="q" defaultValue={sp.q || ''} placeholder="asset tag, name, model" /></div>
        <div><label>Lab</label><select name="lab" defaultValue={sp.lab || ''}><option value="">All labs</option>
          {lk.labs.map((l) => <option key={l.lab_id} value={l.lab_id}>{l.lab_code}</option>)}</select></div>
        <div><label>Category</label><select name="category" defaultValue={sp.category || ''}><option value="">All categories</option>
          {lk.categories.map((c) => <option key={c.category_id} value={c.category_id}>{'  '.repeat(c.depth)}{c.category_name}</option>)}</select></div>
        <div><label>Status</label><select name="status" defaultValue={sp.status || ''}><option value="">Any</option>
          {['operational', 'faulty', 'under_maintenance', 'retired'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
        <button className="btn secondary">Apply</button>
      </form>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Asset</th><th>Category</th><th>Lab</th><th>Make / model</th><th>Status</th><th className="num">Failures</th><th className="num">Active</th></tr></thead>
        <tbody>{rows.map((e) => (
          <tr key={e.equipment_id}>
            <td><Link className="cell-title" href={`/equipment/${e.equipment_id}`}>{e.asset_tag}</Link><div className="cell-sub">{e.equipment_name}</div></td>
            <td>{e.category_name}</td><td>{e.lab_code}</td>
            <td>{e.manufacturer}<div className="cell-sub">{e.model_no}</div></td>
            <td><EquipmentBadge value={e.status} /></td>
            <td className="num">{e.failures}</td><td className="num">{e.active_incidents || <span className="muted">0</span>}</td>
          </tr>))}
        </tbody></table></div></div>
    </>
  );
}
