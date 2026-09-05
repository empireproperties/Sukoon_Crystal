/* Removes seeded demo data from the LIVE store.
 *
 *   node clean-demo-data.js --dry-run     # show what would go, write nothing
 *   node clean-demo-data.js               # do it (backs up first)
 *
 * Unlike migrate-to-cockroach.js this reads and writes the real database rather
 * than data/db.json, so it is safe to run once the app is already serving from
 * CockroachDB and db.json has gone stale.
 *
 * What counts as real and is always kept:
 *   - orders and customers that came from Shopify (`shopifyId`)
 *   - orders and bookings placed through the live site (`source: 'Website'`)
 *   - every product, category, service, banner, event and page
 *   - every admin account
 */
import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, closeDb, db, saveNow, COLLECTIONS } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const KEEP_RATINGS = process.argv.includes('--keep-ratings');

/* Never emptied by this script, whatever else changes. Losing these would lock
   the owner out of their own admin panel. */
const PROTECTED = new Set(['admins']);

const info = await initDb();
console.log(`\nCleaning seeded demo data${DRY ? '  (DRY RUN, nothing written)' : ''}`);
console.log(`  store: ${info.mode}${info.db ? ` (${info.db})` : ''}\n`);

const before = Object.fromEntries(COLLECTIONS.map((c) => [c, (db[c] || []).length]));
const isReal = (o) => Boolean(o.shopifyId) || o.source === 'Website';

/* ------------------------------------------------------------------ compute */

const nextOrders = (db.orders || []).filter(isReal);
const nextCustomers = (db.customers || []).filter((c) => c.shopifyId);
const nextBookings = (db.bookings || []).filter((b) => b.source === 'Website');

/* `sold` was counted from the invented orders -- recompute it from survivors. */
const sold = new Map();
for (const o of nextOrders) {
  if (o.status === 'cancelled') continue;
  for (const it of o.items || []) {
    if (it.productId) sold.set(it.productId, (sold.get(it.productId) || 0) + (it.qty || 1));
  }
}

let ratingsCleared = 0;
const nextProducts = (db.products || []).map((p) => {
  const out = { ...p, sold: sold.get(p.id) || 0 };
  /* The seeder invented a star rating and a review count for every product.
     Leaving them would mean the storefront shows ratings nobody ever gave. */
  if (!KEEP_RATINGS && (p.reviews || p.rating)) {
    if (p.reviews) ratingsCleared++;
    out.rating = 0;
    out.reviews = 0;
  }
  return out;
});

const after = {
  ...before,
  orders: nextOrders.length,
  customers: nextCustomers.length,
  bookings: nextBookings.length,
  visits: 0,
  payments: 0,
};

/* --------------------------------------------------------------------- show */

let changed = false;
for (const c of COLLECTIONS) {
  if (before[c] === after[c]) continue;
  changed = true;
  console.log(`  ${c.padEnd(11)} ${String(before[c]).padStart(6)} -> ${String(after[c]).padStart(6)}   (drops ${before[c] - after[c]})`);
}
for (const c of PROTECTED) console.log(`  ${c.padEnd(11)} ${String(before[c] ?? 0).padStart(6)} -> ${String(before[c] ?? 0).padStart(6)}   (protected, never touched)`);
if (ratingsCleared) {
  changed = true;
  console.log(`\n  ratings     cleared invented rating/review counts on ${ratingsCleared} product(s)`);
  console.log('              (products themselves are all kept)');
}
const soldChanges = (db.products || []).filter((p) => (p.sold || 0) !== (sold.get(p.id) || 0)).length;
if (soldChanges) console.log(`  sold        recomputed on ${soldChanges} product(s) from the orders that remain`);

if (!changed) {
  console.log('\n  Nothing to clean -- the store has no seeded demo data left.\n');
  await closeDb();
  process.exit(0);
}

if (DRY) {
  console.log('\nDry run -- nothing written. Re-run without --dry-run to apply.\n');
  await closeDb();
  process.exit(0);
}

/* -------------------------------------------------------------------- apply */

/* A full snapshot of the live store before anything is removed. This is the
   only copy of the demo data once the script finishes. */
const snapshot = Object.fromEntries(COLLECTIONS.map((c) => [c, db[c]]));
snapshot.settings = db.settings;
delete snapshot.admins;                       /* password hashes stay out of backups */

const backup = path.join(__dirname, 'data', `db.pre-clean.${Date.now()}.json`);
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.writeFileSync(backup, JSON.stringify(snapshot, null, 2));

db.products = nextProducts;
db.orders = nextOrders;
db.customers = nextCustomers;
db.bookings = nextBookings;
db.visits = [];
db.payments = [];

await saveNow();
await closeDb();

console.log(`\n  backup written: data/${path.basename(backup)}  (admins excluded)`);
console.log('  Done. Restart the server to serve the cleaned store.\n');
