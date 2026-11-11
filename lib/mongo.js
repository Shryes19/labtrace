// MongoDB connection (document store + vector search for the knowledge base)
import { MongoClient, ObjectId } from 'mongodb';
import { createDevDb } from './devstore.js';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/?directConnection=true';
const DB_NAME = process.env.MONGODB_DB || 'labtrace_kb';

export const COLLECTIONS = { incidents: 'incident_knowledge', articles: 'kb_articles' };

export async function getMongo() {
  if (!globalThis.__labtraceMongo) {
    globalThis.__labtraceMongo = (async () => {
      if (URI.startsWith('file:')) return createDevDb(URI.slice(5));
      const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(DB_NAME);
      await ensureIndexes(db);
      return db;
    })().catch((e) => {
      globalThis.__labtraceMongo = null;
      throw e;
    });
  }
  return globalThis.__labtraceMongo;
}

async function ensureIndexes(db) {
  const inc = db.collection(COLLECTIONS.incidents);
  await inc.createIndex({ incident_id: 1 }, { unique: true });
  await inc.createIndex({ 'equipment.category': 1, status: 1 });
  await inc.createIndex({ tags: 1 });
  const art = db.collection(COLLECTIONS.articles);
  await art.createIndex({ category: 1 });
  await art.createIndex({ tags: 1 });
}

export function toId(id) {
  if (URI.startsWith('file:')) return String(id);
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(String(id));
}

export const isDevStore = () => URI.startsWith('file:');
