// =====================================================================
// LabTrace | Vector search index - OPTIONAL, needs MongoDB Atlas or the
//            mongodb/mongodb-atlas-local image (plain MongoDB 7 uses the app's exact cosine k-NN instead)
// Run AFTER `npm run kb:sync` has inserted documents:
//   mongosh "mongodb://localhost:27017/?directConnection=true" nosql/02_vector_index.js
// then set MONGODB_VECTOR_SEARCH=atlas in .env.local
// =====================================================================
db = db.getSiblingDB('labtrace_kb');

const definition = {
  fields: [
    { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
    { type: 'filter', path: 'embedding_model' },
    { type: 'filter', path: 'status' },
    { type: 'filter', path: 'incident_id' }
  ]
};
db.incident_knowledge.createSearchIndex({ name: 'vector_index', type: 'vectorSearch', definition });
db.kb_articles.createSearchIndex({
  name: 'vector_index', type: 'vectorSearch',
  definition: { fields: [
    { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
    { type: 'filter', path: 'embedding_model' }
  ] }
});
printjson(db.incident_knowledge.getSearchIndexes());
