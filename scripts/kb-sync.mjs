// npm run kb:sync  ->  builds the MongoDB knowledge base (incident_knowledge + kb_articles)
// from the PostgreSQL data, computing a vector embedding for every document.
import { syncKnowledgeBase } from '../lib/kbsync.js';

const admin = { id: Number(process.env.KB_SYNC_ADMIN_ID || 1), role: 'admin', name: 'kb-sync' };
console.log('Syncing knowledge base from PostgreSQL -> MongoDB ...');
try {
  const r = await syncKnowledgeBase(admin, { log: console.log });
  console.log('Done:', r);
  process.exit(0);
} catch (e) {
  console.error('kb:sync failed:', e.message);
  process.exit(1);
}
