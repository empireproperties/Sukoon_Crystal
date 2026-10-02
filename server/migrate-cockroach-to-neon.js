/* Transfers all collections directly from CockroachDB to Neon (or another PostgreSQL).
 *
 * Usage:
 *   node migrate-cockroach-to-neon.js --from "postgresql://sukoon:...@...cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" --to "postgresql://user:...@...neon.tech/neondb?sslmode=require"
 *
 * Or if you set NEON_DATABASE_URL in server/.env, simply:
 *   node migrate-cockroach-to-neon.js
 */
import './env.js';
import pg from 'pg';
import { COLLECTIONS } from './db.js';

const { Pool } = pg;

const argv = process.argv.slice(2);
const getArg = (flag) => {
  const i = argv.indexOf(`--${flag}`);
  return i > -1 && argv[i + 1] ? argv[i + 1] : null;
};

const sourceUrl = getArg('from') || process.env.COCKROACH_URL || process.env.DATABASE_URL;
const targetUrl = getArg('to') || process.env.NEON_DATABASE_URL || process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error(`
Usage:
  node migrate-cockroach-to-neon.js --from "<cockroach_url>" --to "<neon_url>"

Or set NEON_DATABASE_URL in server/.env and run:
  node migrate-cockroach-to-neon.js
`);
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error('Error: Source and Target database URLs are identical.');
  process.exit(1);
}

const ident = (n) => `"${n}"`;
const CHUNK = 400;
const chunks = function* (arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
};

async function migrate() {
  console.log('\n--- Migrating CockroachDB -> Neon PostgreSQL ---');
  console.log(`Source : ${new URL(sourceUrl).host}`);
  console.log(`Target : ${new URL(targetUrl).host}\n`);

  const sourcePool = new Pool({ connectionString: sourceUrl, ssl: { rejectUnauthorized: true } });
  const targetPool = new Pool({ connectionString: targetUrl, ssl: { rejectUnauthorized: true } });

  try {
    // 1. Ensure target schema
    console.log('Ensuring tables on Neon...');
    for (const name of COLLECTIONS) {
      await targetPool.query(`
        CREATE TABLE IF NOT EXISTS ${ident(name)} (
          key        TEXT PRIMARY KEY,
          doc        JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    }
    await targetPool.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        key        TEXT PRIMARY KEY,
        doc        JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 2. Transfer collections
    for (const name of COLLECTIONS) {
      const { rows } = await sourcePool.query(`SELECT key, doc FROM ${ident(name)}`);
      if (!rows.length) {
        console.log(`  ${name.padEnd(12)} : 0 rows`);
        continue;
      }

      // Filter out demo visits if desired to keep Neon clean
      const toWrite = name === 'visits' && rows.length > 2000 ? rows.slice(-2000) : rows;

      const client = await targetPool.connect();
      try {
        await client.query('BEGIN');
        for (const batch of chunks(toWrite, CHUNK)) {
          const values = batch.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
          const params = batch.flatMap((r) => [r.key, JSON.stringify(r.doc)]);
          await client.query(
            `INSERT INTO ${ident(name)} (key, doc) VALUES ${values}
             ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
            params
          );
        }
        await client.query('COMMIT');
        console.log(`  ${name.padEnd(12)} : ${toWrite.length} rows transferred ${rows.length > toWrite.length ? `(capped from ${rows.length})` : ''}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    // 3. Transfer settings
    const { rows: settingsRows } = await sourcePool.query('SELECT key, doc FROM "settings"');
    for (const r of settingsRows) {
      await targetPool.query(
        `INSERT INTO "settings" (key, doc) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
        [r.key, JSON.stringify(r.doc)]
      );
    }
    console.log(`  settings     : ${settingsRows.length} transferred`);

    console.log('\nMigration to Neon completed successfully!\n');
  } catch (err) {
    if (err.message?.includes('Request Unit limit')) {
      console.error('\n! CockroachDB is currently disabled due to Request Unit limit.');
      console.error('  Please set Spend Limit to $1 in Cockroach Cloud console first to unlock reads.');
      console.error('  Or migrate from local data/db.json using:');
      console.error('  node migrate-to-cockroach.js --clean-demo --url "<neon_url>"\n');
    } else {
      console.error('\nMigration error:', err.message);
    }
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

migrate();
