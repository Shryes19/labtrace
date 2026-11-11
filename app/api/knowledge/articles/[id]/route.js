import { apiHandler, readJson, requireApiUser } from '@/lib/auth';
import { getArticle, updateArticle, deleteArticle } from '@/lib/knowledge';

// READ
export const GET = apiHandler(async (req, { params }) => {
  await requireApiUser();
  const { id } = await params;
  return { article: await getArticle(id) };
});

// UPDATE (technician / admin) - re-computes the embedding if text changed
export const PATCH = apiHandler(async (req, { params }) => {
  const user = await requireApiUser('technician', 'admin');
  const { id } = await params;
  await updateArticle(id, await readJson(req), user);
  return { ok: true };
});

// DELETE (admin only)
export const DELETE = apiHandler(async (req, { params }) => {
  await requireApiUser('admin');
  const { id } = await params;
  await deleteArticle(id);
  return { ok: true };
});
