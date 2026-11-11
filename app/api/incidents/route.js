import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { listIncidents, incidentKnowledgeRow } from '@/lib/queries';
import { upsertIncidentKnowledge, safely } from '@/lib/knowledge';

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await withUser(user, (c) => listIncidents(c, { ...sp, userId: user.id }));
  return { incidents: rows };
});

// Report a new incident (any logged-in user; RLS forces reported_by = self for students)
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser();
  const b = await readJson(req);
  const equipmentId = Number(b.equipment_id);
  if (!equipmentId) throw new HttpError(400, 'Select the equipment');
  if (!b.title || b.title.trim().length < 5) throw new HttpError(400, 'Title must be at least 5 characters');
  if (!b.description || b.description.trim().length < 10) throw new HttpError(400, 'Describe the problem (min 10 characters)');
  const severity = ['low', 'medium', 'high', 'critical'].includes(b.severity) ? b.severity : 'medium';

  const { id, row } = await withUser(user, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO incidents (equipment_id, reported_by, title, description, severity)
       VALUES ($1, $2, $3, $4, $5) RETURNING incident_id`,
      [equipmentId, user.id, b.title.trim().slice(0, 150), b.description.trim(), severity]);
    const id = rows[0].incident_id;
    return { id, row: await incidentKnowledgeRow(c, id) };
  });
  // store the failure description in the MongoDB knowledge base (with its embedding)
  await safely(() => upsertIncidentKnowledge(row));
  return { ok: true, incident_id: id };
});
