/* One-shot migration: data/db.json -> CockroachDB, images -> Cloudinary.
 *
 *   node migrate-to-cockroach.js --dry-run
 *   node migrate-to-cockroach.js --clean-demo --cloudinary
 *   node migrate-to-cockroach.js --clean-demo --cloudinary --fresh
 *
 * Reads the JSON file directly rather than through db.js, so it works the same
 * whether or not DATABASE_URL is already pointing the app at CockroachDB.
 */
import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { COLLECTIONS, keyOf } = await import('./db.js');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const str = (f) => {
  const i = argv.indexOf(`--${f}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

const DRY = has('dry-run');
const FRESH = has('fresh');
const CLEAN = has('clean-demo');
const CLOUD = has('cloudinary');

if (str('url')) process.env.DATABASE_URL = str('url');

/* --------------------------------------------------------- demo data removal */

/* The seeded dataset invents orders, bookings and traffic to make the demo look
   alive. None of it should reach a production database, but real Shopify rows
   and anything placed through the live site must survive. */
function stripDemoData(data, log) {
  const before = Object.fromEntries(COLLECTIONS.map((c) => [c, (data[c] || []).length]));

  data.orders = (data.orders || []).filter((o) => o.shopifyId || o.source === 'Website');
  data.customers = (data.customers || []).filter((c) => c.shopifyId);
  data.visits = [];
  data.payments = [];
  data.bookings = (data.bookings || []).filter((b) => b.source === 'Website');

  /* `sold` counted the fake orders we just dropped -- recompute from what's left. */
  const sold = new Map();
  for (const o of data.orders) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items || []) {
      if (it.productId) sold.set(it.productId, (sold.get(it.productId) || 0) + (it.qty || 1));
    }
  }
  for (const p of data.products || []) p.sold = sold.get(p.id) || 0;

  for (const c of COLLECTIONS) {
    const now = (data[c] || []).length;
    if (now !== before[c]) log(`    ${c}: ${before[c]} -> ${now}  (dropped ${before[c] - now})`);
  }

  const invented = (data.products || []).filter((p) => p.reviews > 0).length;
  if (invented) {
    log(`    note: ${invented} product(s) still carry seeded rating/reviews figures.`);
    log('          Left alone deliberately -- clear them in the admin if you want.');
  }
  return data;
}

/* ------------------------------------------------------------------ cockroach */

/** Rejects a collection whose keys collide, before it silently loses rows. */
function keyed(name, docs, log) {
  const seen = new Map();
  const entries = [];
  docs.forEach((doc, i) => {
    const key = keyOf(doc, i);
    if (seen.has(key)) {
      log(`    ! ${name}: duplicate key ${key} -- later row wins`);
      entries[seen.get(key)] = [key, doc];
    } else {
      seen.set(key, entries.length);
      entries.push([key, doc]);
    }
  });
  return entries;
}

/* db.json predates admin accounts and has no `admins` key, so a --fresh run
   would replace the table with nothing and delete the only login. */
const PROTECTED = new Set(['admins']);

async function pushToCockroach(data, log) {
  const pg = await import('./postgres.js');
  await pg.ensureSchema(COLLECTIONS);

  try {
    for (const name of COLLECTIONS) {
      if (PROTECTED.has(name) && !(data[name] || []).length) {
        const n = (await pg.rowCounts([name]))[name];
        log(`    ${name.padEnd(12)} ${String(n).padStart(5)} kept, protected from --fresh`);
        continue;
      }
      const entries = keyed(name, data[name] || [], log);

      /* --fresh replaces the table wholesale; otherwise upsert on the primary
         key, so a re-run updates rows rather than duplicating them. */
      if (FRESH) await pg.replaceCollection(name, entries);
      else if (entries.length) await pg.applyChanges(name, entries, []);

      const counts = await pg.rowCounts([name]);
      log(`    ${name.padEnd(12)} ${String(entries.length).padStart(5)} sent, ${counts[name]} in CockroachDB`);
    }

    await pg.saveSettings('singleton', data.settings || {});
    log('    settings      written');
  } finally {
    await pg.closePool();
  }
}

/* ---------------------------------------------------------------------- main */

const log = console.log;

if (!fs.existsSync(DB_FILE)) {
  console.error('No data/db.json found. Run the Shopify import or `npm run seed` first.');
  process.exit(1);
}
if (!process.env.DATABASE_URL && !DRY) {
  console.error(
    'No CockroachDB connection string.\n' +
    '  Set DATABASE_URL in server/.env, or pass --url "postgresql://..."\n' +
    '  Cockroach Cloud: Cluster > Connect > General connection string.'
  );
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
log(`\nMigrating data/db.json${DRY ? '  (DRY RUN, nothing written)' : ''}`);
log(`  source: ${COLLECTIONS.map((c) => `${c} ${(data[c] || []).length}`).filter((s) => !s.endsWith(' 0')).join(', ')}\n`);

if (CLEAN) {
  log('  stripping seeded demo data:');
  stripDemoData(data, log);
  log('');
}

if (CLOUD) {
  const { configureCloudinary, migrateImagesToCloudinary } = await import('./cloudinary.js');
  const { configured, cloud } = configureCloudinary();
  if (!configured) {
    console.error('  ! Cloudinary not configured -- set CLOUDINARY_URL in server/.env. Skipping images.');
  } else {
    log(`  uploading images to Cloudinary (${cloud}):`);
    const img = await migrateImagesToCloudinary(data, { dryRun: DRY });
    if (!DRY && img.total) {
      log(`    ${img.uploaded}/${img.total} uploaded, ${(img.bytes / 1048576).toFixed(1)} MB stored`);
      if (img.failed.length) {
        log(`    ! ${img.failed.length} failed (kept their Shopify URL):`);
        img.failed.slice(0, 5).forEach((f) => log(`      ${f.error}`));
      }
    }
    log('');
  }
}

const remaining = (JSON.stringify(data).match(/cdn\.shopify\.com/g) || []).length;

if (DRY) {
  log('Dry run -- nothing written.');
  log(`Would push: ${COLLECTIONS.map((c) => `${c} ${(data[c] || []).length}`).join(', ')}`);
  log(`Shopify CDN references that would remain: ${remaining}\n`);
} else {
  /* Keep a local copy of exactly what went up. */
  const backup = path.join(__dirname, 'data', `db.pre-migration.${Date.now()}.json`);
  fs.copyFileSync(DB_FILE, backup);
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

  log(`  pushing to CockroachDB${FRESH ? ' after wiping each table' : ''}:`);
  await pushToCockroach(data, log);

  log(`\n  backup of the previous db.json: ${path.basename(backup)}`);
  log(`  Shopify CDN references remaining: ${remaining}${remaining ? '  <-- not yet safe to close Shopify' : '  (clear)'}`);
  log('\nDone. DATABASE_URL is set, so restarting the server now serves from CockroachDB.\n');
}
