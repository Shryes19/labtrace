# LabTrace

**An Intelligent Laboratory Asset Failure Tracking, Maintenance Management and Predictive Reliability System**

UE23CS351A - Database Management Systems mini-project, PES University (Aug-Dec 2026).

LabTrace replaces informal complaint channels (WhatsApp, registers, e-mail) with one system that links every
laboratory asset to its failures, assigned technicians, repairs, spare parts and status history - and lets
technicians find *similar past failures by meaning*, even when they are described in different words.

| Layer | Technology | Why |
|---|---|---|
| Relational DB | **PostgreSQL 16** | strong constraints, triggers, procedures, recursive CTEs, JSONB, roles and **row-level security** |
| Document / vector DB | **MongoDB** (Atlas Local in Docker) | flexible failure narratives, notes and articles + 384-d embeddings and `$vectorSearch` |
| Embeddings | all-MiniLM-L6-v2 via `@huggingface/transformers` (offline fallback built in) | turns text into vectors for semantic search |
| Web app | **Next.js 16** (App Router) + React 19 | pages, API route handlers and server components in one project |
| Auth | bcrypt + signed JWT in an httpOnly cookie | front-end route guard (`proxy.js`) + API checks + database roles |

## Features

- **Three roles** - student, technician, admin - enforced in three places: the UI/`proxy.js`, every API route, and
  **inside PostgreSQL** (`lt_student`, `lt_technician`, `lt_admin` roles, column privileges and RLS policies).
- Report a failure in plain language; while typing, similar resolved incidents and help articles are suggested.
- Admin assigns a technician - or lets the stored procedure pick the best skilled, least loaded one.
- Technician records diagnosis, root cause, action and spare parts in one transaction (`sp_complete_maintenance`);
  a trigger checks and reduces stock.
- Every status change is written to `incident_status_log` (weak entity) by a trigger; invalid transitions are rejected.
- Reporter confirms the fix (close) or reopens it.
- Reliability analytics: MTBF, MTTR, repeat failures, reliability score, risk level and estimated next failure date.
- Knowledge base (MongoDB): semantic vs keyword search, articles CRUD, incident notes and tags.

## Project structure

```
labtrace/
├── app/                      Next.js App Router
│   ├── (auth)/login, register
│   ├── (app)/                logged-in pages (dashboard, incidents, equipment, labs, parts,
│   │                          knowledge, analytics, users)
│   └── api/                  REST route handlers (auth, incidents, equipment, parts, knowledge, users)
├── components/               shared UI (badges, charts, nav, hooks)
├── lib/
│   ├── db.js                 pg pool + withUser(): SET LOCAL ROLE + app.user_id per request
│   ├── auth.js, session.js   JWT session, role guards
│   ├── queries.js            SQL used by the pages
│   ├── mongo.js              MongoDB connection
│   ├── knowledge.js          knowledge base CRUD + vector search
│   ├── embeddings.js         text -> 384-d vectors
│   └── kbsync.js             rebuild MongoDB from PostgreSQL
├── proxy.js                  route protection (Next.js 16 proxy / middleware)
├── sql/                      01_schema … 07_dml_demo  (+ logs/ with execution output)
├── nosql/                    mongosh scripts: collections, vector index, CRUD + vector queries
├── scripts/                  setup_db.sh, generate_seed.py, kb-sync.mjs, smoke-test.mjs, screenshots.py
├── data/kb-articles.json     seed articles
├── docs/                     project report (.docx), ER & schema diagrams, screenshots, result images, test log
└── docker-compose.yml        PostgreSQL + MongoDB Atlas Local
```

## Running it locally

Requirements: Node.js 20.9+, Docker (or a local PostgreSQL 16 + MongoDB), Python 3 only if you want to regenerate seed data.

1. **Start the databases**
   ```bash
   docker compose up -d
   ```
2. **Create the PostgreSQL database** (schema, functions, triggers, views, roles/RLS, sample data)
   ```bash
   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/setup_db.sh
   ```
   If `psql` is not installed, the script uses the Docker container automatically. On Windows without bash
   (e.g. PowerShell), create the database `labtrace` and run the files `sql/01_…` to `sql/05_…` in order with
   `psql -U postgres -d labtrace -f <file>`.
3. **Install and configure**
   ```bash
   npm install
   cp .env.example .env.local
   ```
4. **Build the MongoDB knowledge base** (embeds every incident + seeds articles)
   ```bash
   mongosh "mongodb://localhost:27017/?directConnection=true" nosql/01_create_collections.js   # optional: validators + indexes
   npm run kb:sync
   mongosh "mongodb://localhost:27017/?directConnection=true" nosql/02_vector_index.js         # optional: Atlas vector index
   ```
   After creating the vector index you can set `MONGODB_VECTOR_SEARCH=atlas` in `.env.local`. With `app` the
   app computes exact cosine similarity itself, which works on any MongoDB.
5. **Run**
   ```bash
   npm run dev        # http://localhost:3000
   npm run test:smoke # in a second terminal - 29 end-to-end API checks
   ```

Demo accounts (password `Password@123`): `admin@labtrace.edu`, `tech@labtrace.edu`, `student@labtrace.edu`.

**Embeddings:** with `EMBEDDING_PROVIDER=auto`, the MiniLM model is downloaded from Hugging Face the first time
(~90 MB) and cached. If that is not possible, a built-in offline embedder is used automatically. Every stored
vector records which model produced it; run `npm run kb:sync` again after switching.

**No MongoDB?** Set `MONGODB_URI=file:./.data/kb` to use a small JSON-file store with the same API (development only).

## Database highlights

- 11 tables, CHECK / UNIQUE / FK constraints, a stored generated column (`labour_hours`), JSONB specs, partial unique index.
- 7 triggers, 3 stored procedures, 9 functions, 4 views (`security_invoker`).
- Recursive CTEs (category tree, auto-assignment, status timeline), correlated and nested sub-queries, window functions, set operations - see `sql/06_queries.sql`.
- RBAC in the database: `sql/04_security.sql`. Demonstration with expected errors: `sql/07_dml_demo.sql` → `sql/logs/07_dml_demo.log`.
