/* One-shot migration: data/db.json -> MongoDB Atlas, images -> Cloudinary.
 *
 *   node migrate-to-mongo.js --dry-run
 *   node migrate-to-mongo.js --clean-demo --cloudinary
 *   node migrate-to-mongo.js --clean-demo --cloudinary --fresh
 *
 * Reads the JSON file directly rather than through db.js, so it works the same
 * whether or not MONGODB_URI is already pointing the app at Atlas.
 */
import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const { COLLECTIONS } = await import('./db.js');
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

const URI = process.env.MONGODB_URI || str('uri') || '';
const DBNAME = process.env.MONGODB_DB || str('db') || 'sukoon';

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

/* ------------------------------------------------------------------ mongo io */

const INDEXES = {
  products: [{ key: { id: 1 }, unique: true }, { key: { slug: 1 } }, { key: { shopifyId: 1 }, sparse: true }, { key: { active: 1, category: 1 } }],
  orders: [{ key: { id: 1 }, unique: true }, { key: { number: 1 } }, { key: { createdAt: -1 } }, { key: { status: 1 } }],
  customers: [{ key: { id: 1 }, unique: true }, { key: { email: 1 } }],
  categories: [{ key: { slug: 1 }, unique: true }],
  pages: [{ key: { id: 1 }, unique: true }, { key: { handle: 1 } }],
  bookings: [{ key: { id: 1 }, unique: true }, { key: { date: 1 } }],
  banners: [{ key: { id: 1 }, unique: true }],
  events: [{ key: { id: 1 }, unique: true }],
  visits: [{ key: { at: -1 } }],
  payments: [{ key: { id: 1 }, unique: true }, { key: { razorpayOrderId: 1 } }],
};

async function pushToMongo(data, log) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(URI, { retryWrites: true });
  await client.connect();
  const mongo = client.db(DBNAME);

  try {
    for (const name of COLLECTIONS) {
      const docs = data[name] || [];
      const coll = mongo.collection(name);

      if (FRESH) await coll.deleteMany({});
      if (docs.length) {
        /* Upsert on the app's own `id` so a re-run updates rather than duplicates. */
        const ops = docs.map((doc, i) => ({
          replaceOne: {
            filter: { id: doc.id || doc.slug || doc.handle || `idx_${i}` },
            replacement: { ...doc, id: doc.id || doc.slug || doc.handle || `idx_${i}` },
            upsert: true,
          },
        }));
        /* Batched -- one bulkWrite of 12k visit docs would exceed the BSON limit. */
        for (let i = 0; i < ops.length; i += 500) {
          await coll.bulkWrite(ops.slice(i, i + 500), { ordered: false });
        }
      }
      const count = await coll.countDocuments();
      log(`    ${name.padEnd(12)} ${String(docs.length).padStart(5)} sent, ${count} in Atlas`);
    }

    await mongo.collection('settings').replaceOne({ _id: 'singleton' }, data.settings || {}, { upsert: true });

    for (const [name, specs] of Object.entries(INDEXES)) {
      await mongo.collection(name).createIndexes(specs.map((s) => ({ ...s, background: true }))).catch(() => {});
    }
    log('    indexes created');
  } finally {
    await client.close();
  }
}

/* ---------------------------------------------------------------------- main */

const log = console.log;

if (!fs.existsSync(DB_FILE)) {
  console.error(`No data/db.json found. Run the Shopify import first.`);
  process.exit(1);
}
if (!URI && !DRY) {
  console.error(
    'No MongoDB connection string.\n' +
    '  Set MONGODB_URI in server/.env, or pass --uri "mongodb+srv://..."\n' +
    '  Atlas: create a free M0 cluster, Database Access > add a user,\n' +
    '  Network Access > allow your IP, then Connect > Drivers > copy the URI.'
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
  log('Dry run — nothing written.');
  log(`Would push: ${COLLECTIONS.map((c) => `${c} ${(data[c] || []).length}`).join(', ')}`);
  log(`Shopify CDN references that would remain: ${remaining}\n`);
} else {
  /* Keep a local copy of exactly what went up. */
  const backup = path.join(__dirname, 'data', `db.pre-migration.${Date.now()}.json`);
  fs.copyFileSync(DB_FILE, backup);
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

  log(`  pushing to Atlas (${DBNAME})${FRESH ? ' after wiping collections' : ''}:`);
  await pushToMongo(data, log);

  log(`\n  backup of the previous db.json: ${path.basename(backup)}`);
  log(`  Shopify CDN references remaining: ${remaining}${remaining ? '  <-- not yet safe to close Shopify' : '  (clear)'}`);
  log('\nDone. Set MONGODB_URI in server/.env and restart to serve from Atlas.\n');
}
