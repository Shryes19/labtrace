import { apiHandler, requireApiUser } from '@/lib/auth';
import { syncKnowledgeBase } from '@/lib/kbsync';

// Rebuild the MongoDB knowledge base from PostgreSQL (admin)
export const POST = apiHandler(async () => {
  const user = await requireApiUser('admin');
  return { ok: true, ...(await syncKnowledgeBase(user)) };
});
