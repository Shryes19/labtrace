import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { inr } from '@/components/format';
import { RestockButton, PartForm } from './PartActions';

export const dynamic = 'force-dynamic';

export default async function PartsPage() {
  const user = await requirePageUser('technician', 'admin');
  const parts = await withUser(user, async (c) => (await c.query(
    `SELECT sp.*,
            COALESCE((SELECT SUM(quantity) FROM part_usage pu WHERE pu.part_id = sp.part_id), 0) AS total_used,
            COALESCE((SELECT SUM(quantity * unit_cost_at_use) FROM part_usage pu WHERE pu.part_id = sp.part_id), 0) AS total_spent
       FROM spare_parts sp ORDER BY part_category, part_name`)).rows);
  const low = parts.filter((p) => p.qty_in_stock <= p.reorder_level).length;
  return (
    <>
      <div className="page-head"><div><h1>Spare parts inventory</h1>
        <div className="sub">{parts.length} parts · {low} at or below reorder level · stock is reduced automatically by a trigger when a technician records part usage</div></div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Part</th><th>Category</th><th className="num">Unit cost</th><th className="num">In stock</th><th className="num">Reorder at</th><th className="num">Used (all time)</th><th className="num">Spent</th>{user.role === 'admin' && <th />}</tr></thead>
        <tbody>{parts.map((p) => (
          <tr key={p.part_id}>
            <td className="cell-title">{p.part_name}<div className="cell-sub mono">{p.part_no}</div></td>
            <td>{p.part_category}</td>
            <td className="num">{inr(p.unit_cost)}</td>
            <td className="num">{p.qty_in_stock <= p.reorder_level ? <span className="badge b-warn">{p.qty_in_stock} low</span> : p.qty_in_stock}</td>
            <td className="num">{p.reorder_level}</td>
            <td className="num">{p.total_used}</td>
            <td className="num">{inr(p.total_spent)}</td>
            {user.role === 'admin' && <td><RestockButton partId={p.part_id} /></td>}
          </tr>))}</tbody></table></div></div>
      {user.role === 'admin' && <PartForm />}
    </>
  );
}
