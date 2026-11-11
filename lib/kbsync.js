// Rebuilds the MongoDB knowledge base from PostgreSQL + seeds technical articles.
import fs from 'node:fs';
import path from 'node:path';
import { withUser } from './db.js';
import { incidentKnowledgeRows } from './queries.js';
import { upsertIncidentKnowledge, createArticle, listArticles } from './knowledge.js';
import { getMongo, COLLECTIONS } from './mongo.js';
import { embed } from './embeddings.js';

export async function syncKnowledgeBase(adminUser, { log = () => {} } = {}) {
  const rows = await withUser(adminUser, (c) => incidentKnowledgeRows(c, null));
  let n = 0;
  for (const row of rows) {
    await upsertIncidentKnowledge(row);
    if (++n % 25 === 0) log(`  indexed ${n}/${rows.length} incidents`);
  }
  // seed articles once; re-embed existing ones (embedding model may have changed)
  const db = await getMongo();
  const existing = await listArticles();
  let seeded = 0;
  if (existing.length === 0) {
    const file = path.join(process.cwd(), 'data', 'kb-articles.json');
    const articles = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const a of articles) {
      await createArticle(a, { id: adminUser.id, name: a.author || 'LabTrace Admin' });
      seeded++;
    }
  } else {
    for (const a of existing) {
      const { vector, model } = await embed(`${a.title}. ${a.body}`);
      await db.collection(COLLECTIONS.articles).updateOne({ title: a.title }, { $set: { embedding: vector, embedding_model: model } });
    }
  }
  return { incidents_indexed: rows.length, articles_seeded: seeded, articles_reembedded: existing.length };
}
