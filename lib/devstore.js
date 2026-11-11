// Tiny JSON-file document store that mimics the subset of the MongoDB
// driver API used by LabTrace.  ONLY for running the app without a MongoDB
// server (MONGODB_URI=file:./.data/kb).  Production / demo uses MongoDB.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, p, v) {
  const ks = p.split('.');
  let o = obj;
  ks.slice(0, -1).forEach((k) => { o[k] = o[k] ?? {}; o = o[k]; });
  o[ks.at(-1)] = v;
}
const eq = (a, b) => String(a) === String(b);

function matchCond(val, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case '$eq': return eq(val, arg);
        case '$ne': return !eq(val, arg);
        case '$in': return arg.some((x) => (Array.isArray(val) ? val.some((v) => eq(v, x)) : eq(val, x)));
        case '$nin': return !arg.some((x) => eq(val, x));
        case '$exists': return (val !== undefined) === !!arg;
        case '$gt': return val > arg;
        case '$gte': return val >= arg;
        case '$lt': return val < arg;
        case '$lte': return val <= arg;
        case '$regex': return new RegExp(arg, cond.$options || '').test(String(val ?? ''));
        case '$options': return true;
        default: return false;
      }
    });
  }
  if (Array.isArray(val)) return val.some((v) => eq(v, cond));
  return eq(val, cond);
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(doc, f));
    if (k === '$and') return cond.every((f) => matches(doc, f));
    return matchCond(get(doc, k), cond);
  });
}

function project(doc, projection) {
  if (!projection) return structuredClone(doc);
  const entries = Object.entries(projection);
  const inc = entries.filter(([, v]) => v).map(([k]) => k);
  const out = structuredClone(doc);
  if (inc.length) {
    const r = { _id: doc._id };
    inc.forEach((k) => { const v = get(doc, k); if (v !== undefined) set(r, k, structuredClone(v)); });
    return r;
  }
  entries.forEach(([k]) => delete out[k]);
  return out;
}

class Cursor {
  constructor(docs) { this.docs = docs; }
  sort(spec) {
    const [[k, dir]] = Object.entries(spec);
    this.docs.sort((a, b) => (get(a, k) > get(b, k) ? dir : get(a, k) < get(b, k) ? -dir : 0));
    return this;
  }
  skip(n) { this.docs = this.docs.slice(n); return this; }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  async toArray() { return this.docs; }
}

class Collection {
  constructor(file) {
    this.file = file;
    this.docs = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  }
  _save() { fs.writeFileSync(this.file, JSON.stringify(this.docs)); }
  async createIndex() { return 'ok'; }
  async insertOne(doc) {
    const d = { _id: crypto.randomBytes(12).toString('hex'), ...structuredClone(doc) };
    this.docs.push(d); this._save();
    return { insertedId: d._id };
  }
  async insertMany(docs) { for (const d of docs) await this.insertOne(d); return { insertedCount: docs.length }; }
  async findOne(filter, opts = {}) {
    const d = this.docs.find((x) => matches(x, filter));
    return d ? project(d, opts.projection) : null;
  }
  find(filter = {}, opts = {}) {
    return new Cursor(this.docs.filter((x) => matches(x, filter)).map((d) => project(d, opts.projection)));
  }
  async countDocuments(filter = {}) { return this.docs.filter((x) => matches(x, filter)).length; }
  _apply(doc, update) {
    for (const [k, v] of Object.entries(update.$set || {})) set(doc, k, structuredClone(v));
    for (const [k, v] of Object.entries(update.$inc || {})) set(doc, k, (get(doc, k) || 0) + v);
    for (const [k, v] of Object.entries(update.$push || {})) { const a = get(doc, k) || []; a.push(structuredClone(v)); set(doc, k, a); }
    for (const [k, v] of Object.entries(update.$addToSet || {})) {
      const a = get(doc, k) || []; const vals = v?.$each || [v];
      vals.forEach((x) => { if (!a.some((y) => eq(y, x))) a.push(x); }); set(doc, k, a);
    }
    for (const [k, v] of Object.entries(update.$pull || {})) { set(doc, k, (get(doc, k) || []).filter((x) => !eq(x, v))); }
    for (const k of Object.keys(update.$unset || {})) delete doc[k];
  }
  async updateOne(filter, update, opts = {}) {
    let d = this.docs.find((x) => matches(x, filter));
    if (!d && opts.upsert) {
      d = { _id: crypto.randomBytes(12).toString('hex') };
      Object.entries(filter).forEach(([k, v]) => { if (!k.startsWith('$') && typeof v !== 'object') set(d, k, v); });
      for (const [k, v] of Object.entries(update.$setOnInsert || {})) set(d, k, v);
      this.docs.push(d);
      this._apply(d, update); this._save();
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: d._id };
    }
    if (!d) return { matchedCount: 0, modifiedCount: 0 };
    this._apply(d, update); this._save();
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async deleteOne(filter) {
    const i = this.docs.findIndex((x) => matches(x, filter));
    if (i < 0) return { deletedCount: 0 };
    this.docs.splice(i, 1); this._save();
    return { deletedCount: 1 };
  }
  async deleteMany(filter = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((x) => !matches(x, filter)); this._save();
    return { deletedCount: before - this.docs.length };
  }
  async aggregate() { throw new Error('aggregate() is not supported by the file dev-store'); }
}

export function createDevDb(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cache = new Map();
  return {
    isDevStore: true,
    collection(name) {
      if (!cache.has(name)) cache.set(name, new Collection(path.join(dir, `${name}.json`)));
      return cache.get(name);
    },
  };
}
