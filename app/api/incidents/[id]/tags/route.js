import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { setIncidentTags } from '@/lib/knowledge';

// Update tags of an incident knowledge document (technician / admin)
export const PUT = apiHandler(async (req, { params }) => {
  await requireApiUser('technician', 'admin');
  const { id } = await params;
  const { tags } = await readJson(req);
  return { ok: true, tags: await setIncidentTags(Number(id), tags) };
});
