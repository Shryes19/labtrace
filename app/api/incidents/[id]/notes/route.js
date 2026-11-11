import { withUser, HttpError } from '@/lib/db';
import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { addIncidentNote } from '@/lib/knowledge';

// Add a free-text note to the incident's MongoDB document ($push into an array)
export const POST = apiHandler(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { text } = await readJson(req);
  // visibility check through PostgreSQL RLS (students: own incidents only)
  const visible = await withUser(user, async (c) =>
    (await c.query('SELECT 1 FROM incidents WHERE incident_id = $1', [Number(id)])).rowCount > 0);
  if (!visible) throw new HttpError(404, 'Incident not found');
  const note = await addIncidentNote(Number(id), user, text);
  return { ok: true, note };
});
