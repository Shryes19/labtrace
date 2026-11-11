// =====================================================================
// LabTrace | MongoDB knowledge repository - collection creation
// Run:  mongosh "mongodb://localhost:27017/?directConnection=true" nosql/01_create_collections.js
// =====================================================================
db = db.getSiblingDB('labtrace_kb');

// ---- 1. incident_knowledge : one flexible document per incident -----
db.createCollection('incident_knowledge', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['incident_id', 'title', 'description', 'status', 'embedding', 'embedding_model'],
      properties: {
        incident_id:     { bsonType: 'int', description: 'link to PostgreSQL incidents.incident_id' },
        title:           { bsonType: 'string' },
        description:     { bsonType: 'string', description: 'free-text failure description' },
        severity:        { enum: ['low', 'medium', 'high', 'critical'] },
        status:          { enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened'] },
        equipment:       { bsonType: 'object', description: 'embedded copy: asset_tag, name, category, lab_code' },
        diagnosis:       { bsonType: ['string', 'null'] },
        root_cause:      { bsonType: ['string', 'null'] },
        resolution:      { bsonType: ['string', 'null'] },
        tags:            { bsonType: 'array', items: { bsonType: 'string' } },
        notes:           { bsonType: 'array', description: 'discussion notes [{author, role, text, at}]' },
        embedding:       { bsonType: 'array', minItems: 384, maxItems: 384, description: '384-d sentence embedding' },
        embedding_model: { bsonType: 'string' }
      }
    }
  },
  validationLevel: 'moderate'
});

// ---- 2. kb_articles : technical guides / SOPs -------------------------
db.createCollection('kb_articles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'body', 'embedding'],
      properties: {
        title:    { bsonType: 'string', minLength: 5 },
        body:     { bsonType: 'string', minLength: 20 },
        category: { bsonType: 'string' },
        tags:     { bsonType: 'array', items: { bsonType: 'string' } },
        author:   { bsonType: 'object' },
        views:    { bsonType: ['int', 'long', 'double'] },
        embedding:{ bsonType: 'array' }
      }
    }
  }
});

// ---- ordinary indexes --------------------------------------------------
db.incident_knowledge.createIndex({ incident_id: 1 }, { unique: true });
db.incident_knowledge.createIndex({ 'equipment.category': 1, status: 1 });
db.incident_knowledge.createIndex({ tags: 1 });                       // multikey index
db.incident_knowledge.createIndex({ title: 'text', description: 'text', resolution: 'text' }); // keyword search
db.kb_articles.createIndex({ category: 1 });
db.kb_articles.createIndex({ tags: 1 });

printjson(db.getCollectionNames());
