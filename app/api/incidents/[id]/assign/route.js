import { withUser } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { incidentKnowledgeRow } from '@/lib/queries';
import { upsertIncidentKnowledge, safely } from '@/lib/knowledge';

// Admin assigns a technician (or lets the stored procedure pick automatically)
export const POST = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('admin');
  const { id } = await params;
  const { technician_id, notes } = await readJson(req);
  const out = await withUser(user, async (c) => {
    const { rows } = await c.query('CALL sp_assign_technician($1, $2, $3)',
      [Number(id), technician_id ? Number(technician_id) : null, notes || null]);
    return { technician_id: rows[0].p_technician_id, row: await incidentKnowledgeRow(c, Number(id)) };
  });
  await safely(() => upsertIncidentKnowledge(out.row));
  return { ok: true, technician_id: out.technician_id };
});
