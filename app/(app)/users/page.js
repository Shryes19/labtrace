import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { lookups } from '@/lib/queries';
import { fmtDate } from '@/components/format';
import { UserRowActions, NewUserForm } from './UserActions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await requirePageUser('admin');
  const { users, cats } = await withUser(user, async (c) => ({
    users: (await c.query(
      `SELECT u.user_id, u.institution_id, u.full_name, u.email, u.role, u.department, u.is_active, u.created_at,
              (SELECT string_agg(p.phone_no, ', ') FROM user_phones p WHERE p.user_id = u.user_id) AS phones,
              (SELECT string_agg(c.category_name, ', ') FROM technician_skills s JOIN equipment_categories c ON c.category_id = s.category_id
                WHERE s.technician_id = u.user_id) AS skills,
              (SELECT COUNT(*) FROM incidents i WHERE i.reported_by = u.user_id) AS reports
         FROM users u ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'technician' THEN 1 ELSE 2 END, u.full_name`)).rows,
    cats: (await lookups(c)).categories,
  }));
  return (
    <>
      <div className="page-head"><div><h1>Users & roles</h1>
        <div className="sub">Each application role maps to a PostgreSQL role (lt_student / lt_technician / lt_admin) with its own GRANTs and row-level security policies.</div></div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>User</th><th>ID</th><th>Role</th><th>Skills / reports</th><th>Phones</th><th>Joined</th><th>Manage</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
            <td className="cell-title">{u.full_name}<div className="cell-sub">{u.email}</div></td>
            <td className="mono">{u.institution_id}</td>
            <td><span className={`badge ${u.role === 'admin' ? 'b-violet' : u.role === 'technician' ? 'b-info' : 'b-muted'}`}>{u.role}</span>{!u.is_active && <div className="cell-sub">deactivated</div>}</td>
            <td className="small">{u.role === 'technician' ? u.skills || '-' : `${u.reports} report(s)`}</td>
            <td className="small">{u.phones || '-'}</td>
            <td className="muted">{fmtDate(u.created_at, false)}</td>
            <td><UserRowActions u={u} self={u.user_id === user.id} /></td>
          </tr>))}</tbody></table></div></div>
      <NewUserForm categories={cats} />
    </>
  );
}
