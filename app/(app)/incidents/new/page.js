import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { lookups } from '@/lib/queries';
import ReportForm from './ReportForm';

export const dynamic = 'force-dynamic';

export default async function NewIncidentPage({ searchParams }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { labs, equipment } = await withUser(user, async (c) => ({
    labs: (await lookups(c)).labs,
    equipment: (await c.query(`SELECT e.equipment_id, e.asset_tag, e.equipment_name, e.lab_id, e.status, c.category_name
                                 FROM equipment e JOIN equipment_categories c ON c.category_id = e.category_id
                                WHERE e.status <> 'retired' ORDER BY e.asset_tag`)).rows,
  }));
  return (
    <>
      <div className="page-head"><div><h1>Report an equipment failure</h1>
        <div className="sub">Describe the problem in your own words. LabTrace looks for similar past failures while you type.</div></div></div>
      <ReportForm labs={labs} equipment={equipment} role={user.role} preselect={sp.equipment ? Number(sp.equipment) : null} />
    </>
  );
}
