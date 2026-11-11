import { withUser, HttpError } from '@/lib/db';
import { apiHandler, requireApiUser } from '@/lib/auth';
import { getIncidentDetail } from '@/lib/queries';

export const GET = apiHandler(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const inc = await withUser(user, (c) => getIncidentDetail(c, Number(id)));
  if (!inc) throw new HttpError(404, 'Incident not found (or you are not allowed to see it)');
  return { incident: inc };
});
