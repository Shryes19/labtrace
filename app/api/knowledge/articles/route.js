import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { listArticles, createArticle } from '@/lib/knowledge';

export const GET = apiHandler(async (req) => {
  await requireApiUser();
  const sp = new URL(req.url).searchParams;
  return { articles: await listArticles({ category: sp.get('category'), tag: sp.get('tag') }) };
});

// CREATE (technician / admin)
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser('technician', 'admin');
  const id = await createArticle(await readJson(req), user);
  return { ok: true, id };
});
