import { apiHandler, requireApiUser } from '@/lib/auth';
import { getIncidentKnowledge, deleteIncidentKnowledge } from '@/lib/knowledge';
import { HttpError } from '@/lib/db';

// READ the MongoDB document of an incident (staff)
export const GET = apiHandler(async (req, { params }) => {
  await requireApiUser('technician', 'admin');
  const { id } = await params;
  const doc = await getIncidentKnowledge(id);
  if (!doc) throw new HttpError(404, 'Not in knowledge base');
  return { document: doc };
});

// DELETE it from the knowledge base (admin) - e.g. a wrong / spam report.
// The relational incident record in PostgreSQL is kept for audit.
export const DELETE = apiHandler(async (req, { params }) => {
  await requireApiUser('admin');
  const { id } = await params;
  await deleteIncidentKnowledge(id);
  return { ok: true };
});
