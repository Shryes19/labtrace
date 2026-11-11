// PostgreSQL access layer.
// Every query runs inside a transaction that switches to the database role
// of the logged-in user (lt_student / lt_technician / lt_admin) and sets
// app.user_id, so PostgreSQL's GRANTs and Row-Level Security policies are
// enforced by the database itself - not only by the web app.
import pg from 'pg';

const { Pool, types } = pg;
// return NUMERIC and BIGINT (COUNT) as JS numbers instead of strings
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const ROLE_MAP = { student: 'lt_student', technician: 'lt_technician', admin: 'lt_admin' };

function getPool() {
  if (!globalThis.__labtracePool) {
    globalThis.__labtracePool = new Pool({
      connectionString:
        process.env.DATABASE_URL || 'postgresql://labtrace_app:labtrace_app@localhost:5432/labtrace',
      max: 10,
    });
  }
  return globalThis.__labtracePool;
}

/**
 * Run fn(client) as the given user.  user = { id, role }
 * options.remark -> stored in incident_status_log.remarks by the trigger
 */
export async function withUser(user, fn, options = {}) {
  const dbRole = ROLE_MAP[user?.role];
  if (!dbRole) throw new HttpError(401, 'Not authenticated');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${dbRole}`); // whitelisted value, safe to interpolate
    await client.query('SET LOCAL search_path TO labtrace, public');
    await client.query("SELECT set_config('app.user_id', $1, true)", [String(user.id)]);
    if (options.remark) {
      await client.query("SELECT set_config('app.status_remark', $1, true)", [String(options.remark)]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Queries that run before login (only SECURITY DEFINER functions are allowed). */
export async function anonQuery(sql, params = []) {
  const client = await getPool().connect();
  try {
    await client.query('SET search_path TO labtrace, public');
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Convert a PostgreSQL / app error into { status, message } for API responses. */
export function toHttpError(err) {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  switch (err?.code) {
    case '42501': // insufficient_privilege (GRANT / RLS)
      return { status: 403, message: 'Permission denied by database access policy' };
    case '23505':
      return { status: 409, message: err.detail || err.message };
    case '23503':
      return { status: 409, message: 'This record is referenced by other records and cannot be changed/deleted' };
    case '23514': // check_violation (CHECK constraints and our RAISE ... USING ERRCODE)
    case 'P0001': // RAISE EXCEPTION
    case '22P02':
    case '23502':
      return { status: 400, message: err.message };
    default:
      if (err?.message?.includes('row-level security')) {
        return { status: 403, message: 'Not allowed: row-level security policy rejected this change' };
      }
      console.error(err);
      return { status: 500, message: 'Internal server error' };
  }
}
