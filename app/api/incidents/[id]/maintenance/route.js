import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { incidentKnowledgeRow } from '@/lib/queries';
import { upsertIncidentKnowledge, safely } from '@/lib/knowledge';

// Technician records the repair -> stored procedure sp_complete_maintenance
// (maintenance record + parts (stock trigger) + status change in ONE transaction)
export const POST = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('technician');
  const { id } = await params;
  const b = await readJson(req);
  if (!b.diagnosis || b.diagnosis.trim().length < 5) throw new HttpError(400, 'Diagnosis is required');
  if (!b.action_taken || b.action_taken.trim().length < 5) throw new HttpError(400, 'Describe the action taken');
  const outcome = ['fixed', 'partial', 'not_fixed', 'replaced'].includes(b.outcome) ? b.outcome : 'fixed';
  const parts = (Array.isArray(b.parts) ? b.parts : [])
    .filter((p) => Number(p.part_id) && Number(p.quantity) > 0)
    .map((p) => ({ part_id: Number(p.part_id), quantity: Number(p.quantity) }));
  const started = b.started_at ? new Date(b.started_at) : null;
  if (started && (isNaN(started) || started > new Date())) throw new HttpError(400, 'Start time must be in the past');

  const out = await withUser(user, async (c) => {
    const { rows } = await c.query('CALL sp_complete_maintenance($1,$2,$3,$4,$5,$6,$7::jsonb,NULL)',
      [Number(id), b.diagnosis.trim(), b.root_cause?.trim() || null, b.action_taken.trim(), outcome,
       started ? started.toISOString() : null, JSON.stringify(parts)]);
    return { record_id: rows[0].p_record_id, row: await incidentKnowledgeRow(c, Number(id)) };
  }, { remark: `Maintenance recorded (${outcome})` });
  // the diagnosis + resolution now become searchable knowledge in MongoDB
  await safely(() => upsertIncidentKnowledge(out.row));
  return { ok: true, record_id: out.record_id };
});
