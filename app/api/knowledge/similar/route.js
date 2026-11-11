import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { semanticSearch } from '@/lib/knowledge';

// POST { text, exclude_incident_id } -> similar RESOLVED incidents + articles
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser();
  const { text, exclude_incident_id } = await readJson(req);
  const incidents = await semanticSearch(text, { scope: 'incidents', k: 5, onlyResolved: true, excludeIncidentId: exclude_incident_id });
  const articles = await semanticSearch(text, { scope: 'articles', k: 3 });
  // students see the problem summary only; repair details are for staff
  const strip = (r) => (user.role === 'student' ? { ...r, diagnosis: undefined, resolution: undefined, notes: undefined } : r);
  return { incidents: incidents.map(strip), articles };
});
