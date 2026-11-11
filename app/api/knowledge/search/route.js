import { apiHandler, requireApiUser } from '@/lib/auth';
import { semanticSearch, keywordSearch } from '@/lib/knowledge';

// GET /api/knowledge/search?q=...&mode=semantic|keyword&scope=all|incidents|articles
export const GET = apiHandler(async (req) => {
  await requireApiUser();
  const sp = new URL(req.url).searchParams;
  const q = sp.get('q') || '';
  const mode = sp.get('mode') === 'keyword' ? 'keyword' : 'semantic';
  const scope = ['incidents', 'articles'].includes(sp.get('scope')) ? sp.get('scope') : 'all';
  const k = Math.min(Number(sp.get('k') || 10), 25);
  const results = mode === 'keyword' ? await keywordSearch(q, { scope, k }) : await semanticSearch(q, { scope, k });
  return { mode, results };
});
