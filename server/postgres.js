/* CockroachDB storage driver.
 *
 * The app treats its data as documents -- `db.products` is a plain array of
 * whatever shape the routes put there -- so each collection is one table of
 * `(key STRING PRIMARY KEY, doc JSONB)` rather than a column per field. That
 * keeps the 645 lines of routes in index.js working untouched while the data
 * actually lives in CockroachDB.
 *
 * CockroachDB is a distributed SQL store: it can return a retryable
 * serialization error (SQLSTATE 40001) on any transaction, so every write here
 * goes through `withRetry`.
 */
import pg from 'pg';

const { Pool } = pg;

/* Read at call time, never at import -- .env loads after this module. */
export const connectionString = () =>
  process.env.DATABASE_URL || process.env.COCKROACH_URL || '';

/** The database the URL points at, for the boot banner. */
export function databaseName() {
  try {
    return new URL(connectionString()).pathname.slice(1) || 'defaultdb';
  } catch {
    return 'defaultdb';
  }
}

let pool = null;

/* CockroachDB Cloud serves a publicly-trusted certificate, so the system CA
   store verifies it; `sslmode=verify-full` in the URL needs no downloaded cert.
   rejectUnauthorized stays on -- turning it off would defeat the point. */
export function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: true },
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'sukoon-api',
  });
  /* An idle client dropped by the server must not take the process down. */
  pool.on('error', (e) => console.error('  ! postgres idle client:', e.message));
  return pool;
}

/** Table names come from our own COLLECTIONS list, never from user input. */
const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
};

/* Two families, both worth retrying:
   - SQLSTATE codes CockroachDB returns for contention and admin shutdowns
   - Node socket errors. The serverless tier parks idle connections and cuts
     them, so a pooled client can be dead by the time we use it. These arrive as
     ECONNRESET rather than a SQLSTATE, and missing them crashed boot. */
const RETRYABLE = new Set([
  '40001', '40P01', '08000', '08003', '08006', '57P01', 'XX000',
  'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN',
]);

const isRetryable = (e) =>
  RETRYABLE.has(e?.code)
  /* pg wraps some socket failures without preserving the code. */
  || /ECONNRESET|socket hang up|Connection terminated|timeout expired/i.test(e?.message || '');

async function withRetry(fn, { attempts = 6, label = 'query' } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isRetryable(e)) throw e;
      /* Exponential backoff with jitter, per CockroachDB's retry guidance. */
      const wait = Math.min(2 ** i * 80, 4000) * (0.5 + Math.random());
      console.warn(`  . retrying ${label} after ${e.code || e.message} (attempt ${i})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/* ------------------------------------------------------------------ schema */

/**
 * Creates one table per collection plus the settings singleton. All DDL is
 * IF NOT EXISTS, so this is safe to run on every boot.
 */
export async function ensureSchema(collections) {
  const p = getPool();
  for (const name of collections) {
    await withRetry(
      () =>
        p.query(`
          CREATE TABLE IF NOT EXISTS ${ident(name)} (
            key        STRING PRIMARY KEY,
            doc        JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `),
      { label: `create ${name}` }
    );
  }
  await withRetry(
    () =>
      p.query(`
        CREATE TABLE IF NOT EXISTS "settings" (
          key        STRING PRIMARY KEY,
          doc        JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `),
    { label: 'create settings' }
  );
}

/* -------------------------------------------------------------------- read */

/** Loads one collection in insertion order. */
export async function loadCollection(name) {
  const { rows } = await withRetry(
    () => getPool().query(`SELECT doc FROM ${ident(name)}`),
    { label: `load ${name}` }
  );
  return rows.map((r) => r.doc);
}

export async function loadSettings(id) {
  const { rows } = await withRetry(
    () => getPool().query('SELECT doc FROM "settings" WHERE key = $1', [id]),
    { label: 'load settings' }
  );
  return rows[0]?.doc || null;
}

/* ------------------------------------------------------------------- write */

/* Postgres caps a statement at 65535 bind parameters; 2 per row means chunking
   well under that also keeps each transaction small enough for Cockroach. */
const CHUNK = 400;

const chunks = function* (arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
};

/**
 * Applies a diff to one table in a single transaction: upserts changed rows,
 * deletes removed ones. `upserts` is [key, doc][]; `deletes` is key[].
 */
export async function applyChanges(name, upserts, deletes) {
  if (!upserts.length && !deletes.length) return;
  const table = ident(name);

  await withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      for (const batch of chunks(upserts, CHUNK)) {
        const values = batch.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
        const params = batch.flatMap(([key, doc]) => [key, JSON.stringify(doc)]);
        await client.query(
          `INSERT INTO ${table} (key, doc) VALUES ${values}
           ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
          params
        );
      }

      for (const batch of chunks(deletes, CHUNK * 2)) {
        await client.query(`DELETE FROM ${table} WHERE key = ANY($1)`, [batch]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }, { label: `write ${name}` });
}

/** Replaces every row of a table in one transaction. Used by the importer. */
export async function replaceCollection(name, entries) {
  const table = ident(name);
  await withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM ${table}`);
      for (const batch of chunks(entries, CHUNK)) {
        const values = batch.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
        const params = batch.flatMap(([key, doc]) => [key, JSON.stringify(doc)]);
        await client.query(`INSERT INTO ${table} (key, doc) VALUES ${values}`, params);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }, { label: `replace ${name}` });
}

export async function saveSettings(id, doc) {
  await withRetry(
    () =>
      getPool().query(
        `INSERT INTO "settings" (key, doc) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
        [id, JSON.stringify(doc)]
      ),
    { label: 'write settings' }
  );
}

export async function rowCounts(collections) {
  const out = {};
  for (const name of collections) {
    const { rows } = await getPool().query(`SELECT count(*)::INT AS n FROM ${ident(name)}`);
    out[name] = rows[0].n;
  }
  return out;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}
