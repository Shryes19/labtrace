// =====================================================================
// LabTrace | NoSQL / Vector commands: CREATE, READ, UPDATE, DELETE
// Run:  mongosh "mongodb://localhost:27017/?directConnection=true" nosql/03_crud_and_vector_queries.js
// (the web app performs the same operations through lib/knowledge.js)
// =====================================================================
db = db.getSiblingDB('labtrace_kb');

// ---------------- CREATE ----------------
db.kb_articles.insertOne({
  title: 'Checklist: UPS battery replacement in server racks',
  body: 'Switch the UPS to bypass, disconnect the battery pack, replace with the same model and run a self test.',
  category: 'Server', tags: ['ups', 'battery', 'server'],
  author: { id: 1, name: 'Dr. Sunita Rao' },
  embedding: Array(384).fill(0).map((_, i) => Math.sin(i)),   // the app stores a real model embedding here
  embedding_model: 'demo', views: 0, created_at: new Date(), updated_at: new Date()
});

// ---------------- READ ----------------
// 1. one incident document by its PostgreSQL id
printjson(db.incident_knowledge.findOne({ incident_id: 1 }, { embedding: 0 }));

// 2. filter on embedded document fields + projection + sort + limit
db.incident_knowledge.find(
  { 'equipment.category': 'Desktop Workstation', status: { $in: ['resolved', 'closed'] } },
  { _id: 0, incident_id: 1, title: 1, 'equipment.asset_tag': 1, resolution: 1 }
).sort({ reported_at: -1 }).limit(5).forEach(printjson);

// 3. array query (multikey index) and regex keyword search
db.incident_knowledge.find({ tags: 'thermal / cooling' }, { _id: 0, incident_id: 1, title: 1 }).limit(5).forEach(printjson);
db.incident_knowledge.find({ description: { $regex: 'hot', $options: 'i' } }, { _id: 0, title: 1, description: 1 }).limit(5).forEach(printjson);

// 4. aggregation pipeline - most common root causes per category
db.incident_knowledge.aggregate([
  { $match: { root_cause: { $ne: null } } },
  { $group: { _id: { category: '$equipment.category', cause: '$root_cause' }, n: { $sum: 1 } } },
  { $sort: { n: -1 } }, { $limit: 8 }
]).forEach(printjson);

// 5. VECTOR SEARCH - semantic k-NN on the embedding of a query text.
//    The query vector is produced by the same embedding model (see lib/embeddings.js);
//    here we reuse the stored vector of incident 1 as the query.
const q = db.incident_knowledge.findOne({ incident_id: 1 });
db.incident_knowledge.aggregate([
  { $vectorSearch: {
      index: 'vector_index', path: 'embedding', queryVector: q.embedding,
      numCandidates: 100, limit: 5,
      filter: { embedding_model: q.embedding_model, status: { $in: ['resolved', 'closed'] } } } },
  { $project: { _id: 0, incident_id: 1, title: 1, resolution: 1, score: { $meta: 'vectorSearchScore' } } }
]).forEach(printjson);

// ---------------- UPDATE ----------------
// $set, $addToSet, $push (array of embedded notes), $inc
db.incident_knowledge.updateOne({ incident_id: 1 }, { $addToSet: { tags: 'recurring' }, $set: { updated_at: new Date() } });
db.incident_knowledge.updateOne({ incident_id: 1 }, {
  $push: { notes: { author: 'Ravi Kumar', role: 'technician', text: 'Same fan model failed in 3 PCs - order spares.', at: new Date() } }
});
db.kb_articles.updateOne({ title: /UPS battery/ }, { $inc: { views: 1 }, $set: { category: 'Power' } });
db.kb_articles.updateMany({ category: 'General' }, { $set: { reviewed: true } });

// ---------------- DELETE ----------------
db.incident_knowledge.updateOne({ incident_id: 1 }, { $pull: { tags: 'recurring' } });   // remove array element
db.kb_articles.deleteOne({ title: /UPS battery/ });
db.kb_articles.deleteMany({ embedding_model: 'demo' });

print('incident docs:', db.incident_knowledge.countDocuments(), ' articles:', db.kb_articles.countDocuments());
