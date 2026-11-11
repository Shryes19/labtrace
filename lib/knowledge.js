// Knowledge repository (MongoDB): historical incident knowledge + technical
// articles, with semantic vector search.
import { getMongo, COLLECTIONS, toId, isDevStore } from './mongo.js';
import { embed, cosine } from './embeddings.js';
import { HttpError } from './db.js';

const VECTOR_MODE = (process.env.MONGODB_VECTOR_SEARCH || 'app').toLowerCase(); // 'atlas' | 'app'
const VECTOR_INDEX = process.env.MONGODB_VECTOR_INDEX || 'vector_index';

export function incidentText(d) {
  return [d.title, d.description, d.diagnosis, d.root_cause, d.resolution, d.equipment?.category]
    .filter(Boolean)
    .join('. ');
}

/** Create / refresh the knowledge document of one incident (called after create & repair). */
export async function upsertIncidentKnowledge(row) {
  const db = await getMongo();
  const doc = {
    incident_id: row.incident_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    equipment: {
      id: row.equipment_id,
      asset_tag: row.asset_tag,
      name: row.equipment_name,
      category: row.category_name,
      lab_code: row.lab_code,
    },
    diagnosis: row.diagnosis || null,
    root_cause: row.root_cause || null,
    resolution: row.action_taken || null,
    outcome: row.outcome || null,
    technician: row.technician_name || null,
    reported_at: row.reported_at ? new Date(row.reported_at) : new Date(),
    resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
  };
  const { vector, model } = await embed(incidentText(doc));
  doc.embedding = vector;
  doc.embedding_model = model;
  doc.updated_at = new Date();
  await db.collection(COLLECTIONS.incidents).updateOne(
    { incident_id: row.incident_id },
    {
      $set: doc,
      $setOnInsert: { notes: [], tags: autoTags(doc), created_at: new Date() },
    },
    { upsert: true }
  );
  return doc;
}

function autoTags(doc) {
  const tags = new Set();
  if (doc.equipment?.category) tags.add(doc.equipment.category.toLowerCase());
  if (doc.root_cause) tags.add(doc.root_cause.toLowerCase());
  tags.add(doc.severity);
  return [...tags];
}

const PUBLIC_FIELDS = { embedding: 0 };

/**
 * Semantic search across incident knowledge and/or articles.
 * Returns [{ kind, score (cosine -1..1), ...doc }]
 */
export async function semanticSearch(text, { scope = 'all', k = 5, excludeIncidentId = null, onlyResolved = false } = {}) {
  if (!text || text.trim().length < 3) return [];
  const db = await getMongo();
  const { vector, model } = await embed(text);
  const targets = scope === 'all' ? ['incidents', 'articles'] : [scope];
  const results = [];

  for (const kind of targets) {
    const coll = db.collection(COLLECTIONS[kind]);
    const filter = { embedding_model: model };
    if (kind === 'incidents') {
      if (excludeIncidentId) filter.incident_id = { $ne: Number(excludeIncidentId) };
      if (onlyResolved) filter.status = { $in: ['resolved', 'closed'] };
    }
    let hits = null;
    if (VECTOR_MODE === 'atlas' && !isDevStore()) {
      try {
        hits = await coll
          .aggregate([
            { $vectorSearch: { index: VECTOR_INDEX, path: 'embedding', queryVector: vector, numCandidates: k * 25, limit: k * 3, filter } },
            { $project: { embedding: 0, score: { $meta: 'vectorSearchScore' } } },
          ])
          .toArray();
        hits = hits.map((h) => ({ ...h, score: 2 * h.score - 1 })); // back to cosine scale
      } catch (e) {
        console.warn('[knowledge] $vectorSearch failed, falling back to in-app cosine:', e.message);
        hits = null;
      }
    }
    if (!hits) {
      // brute-force cosine similarity (exact k-NN) - fine for thousands of docs
      const docs = await coll.find(filter).toArray();
      hits = docs
        .map((d) => {
          const score = cosine(vector, d.embedding || []);
          delete d.embedding;
          return { ...d, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, k * 3);
    }
    hits.forEach((h) => results.push({ kind, ...h, _id: String(h._id) }));
  }
  // drop near-duplicates (same title + description) so the list shows variety
  const seen = new Set();
  const unique = results.sort((a, b) => b.score - a.score).filter((r) => {
    const key = `${r.kind}|${r.title}|${r.description || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, k);
}

/** Plain keyword search (for comparison with semantic search). */
export async function keywordSearch(q, { scope = 'all', k = 10 } = {}) {
  if (!q || !q.trim()) return [];
  const db = await getMongo();
  const rx = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const out = [];
  if (scope !== 'articles') {
    const docs = await db.collection(COLLECTIONS.incidents)
      .find({ $or: [{ title: rx }, { description: rx }, { diagnosis: rx }, { resolution: rx }] }, { projection: PUBLIC_FIELDS })
      .limit(k).toArray();
    docs.forEach((d) => out.push({ kind: 'incidents', ...d, _id: String(d._id) }));
  }
  if (scope !== 'incidents') {
    const docs = await db.collection(COLLECTIONS.articles)
      .find({ $or: [{ title: rx }, { body: rx }, { tags: rx }] }, { projection: PUBLIC_FIELDS })
      .limit(k).toArray();
    docs.forEach((d) => out.push({ kind: 'articles', ...d, _id: String(d._id) }));
  }
  return out.slice(0, k);
}

// ------------------------------------------------------------ incident knowledge RUD
export async function getIncidentKnowledge(incidentId) {
  const db = await getMongo();
  const d = await db.collection(COLLECTIONS.incidents).findOne({ incident_id: Number(incidentId) }, { projection: PUBLIC_FIELDS });
  return d ? { ...d, _id: String(d._id) } : null;
}

export async function addIncidentNote(incidentId, user, text) {
  if (!text || !text.trim()) throw new HttpError(400, 'Note text is required');
  const db = await getMongo();
  const note = { author_id: user.id, author: user.name, role: user.role, text: text.trim().slice(0, 2000), at: new Date() };
  const r = await db.collection(COLLECTIONS.incidents).updateOne(
    { incident_id: Number(incidentId) },
    { $push: { notes: note }, $set: { updated_at: new Date() } }
  );
  if (!r.matchedCount) throw new HttpError(404, 'Knowledge document not found for this incident');
  return note;
}

export async function setIncidentTags(incidentId, tags) {
  const clean = [...new Set((tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 15);
  const db = await getMongo();
  const r = await db.collection(COLLECTIONS.incidents).updateOne(
    { incident_id: Number(incidentId) },
    { $set: { tags: clean, updated_at: new Date() } }
  );
  if (!r.matchedCount) throw new HttpError(404, 'Knowledge document not found');
  return clean;
}

export async function deleteIncidentKnowledge(incidentId) {
  const db = await getMongo();
  const r = await db.collection(COLLECTIONS.incidents).deleteOne({ incident_id: Number(incidentId) });
  if (!r.deletedCount) throw new HttpError(404, 'Knowledge document not found');
}

// ------------------------------------------------------------ articles CRUD
export async function listArticles({ category, tag } = {}) {
  const db = await getMongo();
  const filter = {};
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  const docs = await db.collection(COLLECTIONS.articles).find(filter, { projection: PUBLIC_FIELDS }).sort({ updated_at: -1 }).toArray();
  return docs.map((d) => ({ ...d, _id: String(d._id) }));
}

export async function getArticle(id, { countView = false } = {}) {
  const db = await getMongo();
  const _id = toId(id);
  if (!_id) throw new HttpError(400, 'Invalid article id');
  if (countView) await db.collection(COLLECTIONS.articles).updateOne({ _id }, { $inc: { views: 1 } });
  const d = await db.collection(COLLECTIONS.articles).findOne({ _id }, { projection: PUBLIC_FIELDS });
  if (!d) throw new HttpError(404, 'Article not found');
  return { ...d, _id: String(d._id) };
}

function validateArticle(a, partial = false) {
  const out = {};
  if (!partial || a.title !== undefined) {
    if (!a.title || a.title.trim().length < 5) throw new HttpError(400, 'Title must be at least 5 characters');
    out.title = a.title.trim().slice(0, 200);
  }
  if (!partial || a.body !== undefined) {
    if (!a.body || a.body.trim().length < 20) throw new HttpError(400, 'Body must be at least 20 characters');
    out.body = a.body.trim().slice(0, 20000);
  }
  if (!partial || a.category !== undefined) out.category = (a.category || 'General').trim().slice(0, 60);
  if (!partial || a.tags !== undefined) {
    const tags = Array.isArray(a.tags) ? a.tags : String(a.tags || '').split(',');
    out.tags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 15);
  }
  return out;
}

export async function createArticle(data, user) {
  const db = await getMongo();
  const a = validateArticle(data);
  const { vector, model } = await embed(`${a.title}. ${a.body}`);
  const doc = {
    ...a,
    author: { id: user.id, name: user.name },
    embedding: vector,
    embedding_model: model,
    views: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const r = await db.collection(COLLECTIONS.articles).insertOne(doc);
  return String(r.insertedId);
}

export async function updateArticle(id, data, user) {
  const db = await getMongo();
  const _id = toId(id);
  if (!_id) throw new HttpError(400, 'Invalid article id');
  const existing = await db.collection(COLLECTIONS.articles).findOne({ _id });
  if (!existing) throw new HttpError(404, 'Article not found');
  const patch = validateArticle(data, true);
  if (patch.title || patch.body) {
    const { vector, model } = await embed(`${patch.title || existing.title}. ${patch.body || existing.body}`);
    patch.embedding = vector;
    patch.embedding_model = model;
  }
  patch.updated_at = new Date();
  patch.last_edited_by = { id: user.id, name: user.name };
  await db.collection(COLLECTIONS.articles).updateOne({ _id }, { $set: patch });
}

export async function deleteArticle(id) {
  const db = await getMongo();
  const _id = toId(id);
  if (!_id) throw new HttpError(400, 'Invalid article id');
  const r = await db.collection(COLLECTIONS.articles).deleteOne({ _id });
  if (!r.deletedCount) throw new HttpError(404, 'Article not found');
}

export async function kbStats() {
  const db = await getMongo();
  const [incidents, articles, resolved] = await Promise.all([
    db.collection(COLLECTIONS.incidents).countDocuments({}),
    db.collection(COLLECTIONS.articles).countDocuments({}),
    db.collection(COLLECTIONS.incidents).countDocuments({ status: { $in: ['resolved', 'closed'] } }),
  ]);
  return { incidents, articles, resolved, vectorMode: VECTOR_MODE === 'atlas' && !isDevStore() ? 'MongoDB Atlas $vectorSearch' : 'exact cosine k-NN' };
}

/** Safe wrapper - the relational workflow must keep working if MongoDB is down. */
export async function safely(fn, fallback = null) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[knowledge] MongoDB unavailable:', e.message);
    return fallback;
  }
}
