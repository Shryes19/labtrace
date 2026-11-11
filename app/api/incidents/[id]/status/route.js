import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { incidentKnowledgeRow } from '@/lib/queries';
import { upsertIncidentKnowledge, safely } from '@/lib/knowledge';

// Status change. Who may do what is enforced by PostgreSQL:
//  - trigger trg_incident_validate_status  -> only valid transitions
//  - RLS policies -> student: close/reopen own resolved incident,
//                    technician: start work on assigned incident, admin: anything valid
export const PATCH = apiHandler(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { status, remark } = await readJson(req);
  const allowed = ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened'];
  if (!allowed.includes(status)) throw new HttpError(400, 'Invalid status');
  const row = await withUser(user, async (c) => {
    const r = await c.query('UPDATE incidents SET status = $1 WHERE incident_id = $2 RETURNING incident_id', [status, Number(id)]);
    if (!r.rowCount) throw new HttpError(403, 'You are not allowed to change the status of this incident');
    return incidentKnowledgeRow(c, Number(id));
  }, { remark: remark?.slice(0, 300) });
  await safely(() => upsertIncidentKnowledge(row));
  return { ok: true };
});
