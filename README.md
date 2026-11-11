# LabTrace

**An Intelligent Laboratory Asset Failure Tracking, Maintenance Management and Predictive Reliability System**

UE23CS351A - Database Management Systems mini-project, PES University (Aug-Dec 2026).

LabTrace replaces informal complaint channels (WhatsApp, registers, e-mail) with one system that links every
laboratory asset to its failures, assigned technicians, repairs, spare parts and status history - and lets
technicians find *similar past failures by meaning*, even when they are described in different words.

| Layer | Technology | Why |
|---|---|---|
| Relational DB | **PostgreSQL 16** | strong constraints, triggers, procedures, recursive CTEs, JSONB, roles and **row-level security** |
| Document / vector DB | **MongoDB 7** (Docker) | flexible failure narratives, notes and articles + 384-d embeddings and `$vectorSearch` |
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
└── docker-compose.yml        PostgreSQL 16 (port 5433) + MongoDB 7
```

## Running it locally (Windows / PowerShell)

Requirements: Docker Desktop, Node.js 20.9+ and Git. Tested on a 4 GB Windows laptop.

1. **Start the databases**
   ```powershell
   docker compose up -d
   ```
   PostgreSQL listens on port **5433**, MongoDB on **27017**.
2. **Create the PostgreSQL database** (schema, functions, triggers, views, roles/RLS, sample data)
   ```powershell
   docker compose cp sql postgres:/sql
   docker compose exec postgres psql -U postgres -c "CREATE DATABASE labtrace"
   foreach ($f in "01_schema","02_functions_triggers","03_views","04_security","05_seed") {
     docker compose exec postgres psql -U postgres -d labtrace -v ON_ERROR_STOP=1 -q -f "/sql/$f.sql"
   }
   docker compose exec postgres psql -U postgres -d labtrace -c "ALTER ROLE labtrace_app SET search_path = labtrace, public"
   ```
   (Linux / macOS / Git Bash: `./scripts/setup_db.sh` does the same.)
3. **Install and configure**
   ```powershell
   npm install
   Copy-Item .env.example .env.local     # then put a long random value in AUTH_SECRET
   ```
4. **Build the MongoDB knowledge base** (embeds every incident and seeds the articles)
   ```powershell
   npm run kb:sync
   ```
5. **Run**
   ```powershell
   npm run dev          # http://localhost:3000
   npm run test:smoke   # in a second terminal: 29 end-to-end API checks
   ```

**Low-memory laptops:** cap Docker's memory with a `%USERPROFILE%\.wslconfig` file containing
`[wsl2]`, `memory=1GB`, `swap=2GB`, then run `wsl --shutdown` and restart Docker Desktop. If `npm install` runs
out of memory, use `npm install --omit=optional` followed by
`npm install @next/swc-win32-x64-msvc@16.4.6 --no-save` (the Next.js compiler for Windows is an optional package).

**Optional extras:**
- `nosql/01_create_collections.js` adds JSON-schema validators and indexes (run with `mongosh`).
- `EMBEDDING_PROVIDER=auto` uses the all-MiniLM-L6-v2 neural model (needs the optional
  `@huggingface/transformers` package, ~90 MB model download). Re-run `npm run kb:sync` after switching.
- On MongoDB Atlas or the `mongodb/mongodb-atlas-local` image, run `nosql/02_vector_index.js` and set
  `MONGODB_VECTOR_SEARCH=atlas` to use `$vectorSearch`.
- No MongoDB at all? `MONGODB_URI=file:./.data/kb` uses a small JSON-file store with the same API (development only).

Demo accounts (password `Password@123`): `admin@labtrace.edu`, `tech@labtrace.edu`, `student@labtrace.edu`.


## Database highlights

- 11 tables, CHECK / UNIQUE / FK constraints, a stored generated column (`labour_hours`), JSONB specs, partial unique index.
- 7 triggers, 3 stored procedures, 9 functions, 4 views (`security_invoker`).
- Recursive CTEs (category tree, auto-assignment, status timeline), correlated and nested sub-queries, window functions, set operations - see `sql/06_queries.sql`.
- RBAC in the database: `sql/04_security.sql`. Demonstration with expected errors: `sql/07_dml_demo.sql` → `sql/logs/07_dml_demo.log`.
