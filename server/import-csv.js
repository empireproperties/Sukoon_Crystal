/* Imports Shopify CSV exports (customers, orders) straight into the store.
 *
 *   node import-csv.js --customers ~/Downloads/customers_export.csv --dry-run
 *   node import-csv.js --customers customers.csv --orders orders.csv
 *
 * Exists because Shopify removed legacy custom apps for this store, so there is
 * no Admin API token to fetch these with. The CSV export in the store admin is
 * the supported route now, and it needs no credentials at all.
 *
 * Columns are matched by header NAME, case- and space-insensitively, because
 * Shopify's export headers differ between store locales and plan versions.
 * Anything unrecognised is ignored rather than guessed at.
 */
import './env.js';
import fs from 'fs';
import path from 'path';
import { initDb, closeDb, db, saveNow, uid } from './db.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const str = (f) => {
  const i = argv.indexOf(`--${f}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

const DRY = has('dry-run');

/* ------------------------------------------------------------------ csv */

/**
 * A real CSV reader: Shopify quotes any field containing a comma, a newline or
 * a quote, and escapes an inner quote by doubling it. Splitting on commas
 * mangles addresses and multi-line notes, which is most of this file.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  /* Strip a UTF-8 BOM: Excel adds one, and it corrupts the first header. */
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ''));
}

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Rows as objects keyed by normalised header, plus the original header list. */
function readCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0];
  const keys = headers.map(norm);
  return {
    headers,
    rows: rows.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]))),
  };
}

/** First non-empty value among several candidate header names. */
const pick = (row, ...names) => {
  for (const n of names) {
    const v = row[norm(n)];
    if (v) return v;
  }
  return '';
};

const money = (v) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------ customers */

function buildCustomers(rows) {
  const out = [];
  for (const r of rows) {
    const email = pick(r, 'Email').toLowerCase();
    const first = pick(r, 'First Name');
    const last = pick(r, 'Last Name');
    const name = [first, last].filter(Boolean).join(' ').trim();
    if (!email && !name) continue;

    out.push({
      shopifyId: pick(r, 'Customer ID', 'ID') || null,
      email,
      name: name || email,
      phone: pick(r, 'Phone', 'Default Address Phone'),
      city: pick(r, 'Default Address City', 'City'),
      addresses: (() => {
        const line = [
          pick(r, 'Default Address Address1', 'Address1'),
          pick(r, 'Default Address Address2', 'Address2'),
          pick(r, 'Default Address City', 'City'),
          pick(r, 'Default Address Province Code', 'Province'),
          pick(r, 'Default Address Zip', 'Zip'),
        ].filter(Boolean).join(', ');
        return line ? [{ label: 'Home', line }] : [];
      })(),
      acceptsMarketing: /yes|true|subscribed/i.test(pick(r, 'Accepts Email Marketing', 'Email Marketing Consent')),
      totalSpent: money(pick(r, 'Total Spent')),
      ordersCount: Number(pick(r, 'Total Orders', 'Orders Count')) || 0,
      note: pick(r, 'Note'),
      tags: pick(r, 'Tags'),
      createdAt: new Date().toISOString(),
      source: 'Shopify CSV',
    });
  }
  return out;
}

/* --------------------------------------------------------------- orders */

/* Shopify writes one CSV row per LINE ITEM. Only the first row of an order
   carries the customer and totals; the rest repeat the order Name with the
   item columns filled. So rows are grouped by Name and merged. */
function buildOrders(rows) {
  const byNumber = new Map();

  for (const r of rows) {
    const number = pick(r, 'Name', 'Order');
    if (!number) continue;

    if (!byNumber.has(number)) {
      const created = pick(r, 'Created at', 'Paid at') || new Date().toISOString();
      const financial = pick(r, 'Financial Status').toLowerCase();
      const fulfilled = pick(r, 'Fulfillment Status').toLowerCase();

      byNumber.set(number, {
        id: uid('ord'),
        number,
        shopifyId: pick(r, 'Id', 'Order ID') || null,
        createdAt: new Date(created).toISOString(),
        /* Map Shopify's two status fields onto the one this app uses. */
        status: /refund|void/.test(financial) ? 'cancelled'
          : fulfilled === 'fulfilled' ? 'delivered'
          : financial === 'paid' ? 'confirmed' : 'placed',
        payment: /pending/.test(financial) ? 'COD' : 'Prepaid',
        customer: {
          name: [pick(r, 'Billing Name', 'Shipping Name')].filter(Boolean).join(' ')
            || pick(r, 'Email'),
          email: pick(r, 'Email').toLowerCase(),
          phone: pick(r, 'Billing Phone', 'Shipping Phone', 'Phone'),
          address: [pick(r, 'Shipping Address1'), pick(r, 'Shipping Address2')].filter(Boolean).join(', '),
          city: pick(r, 'Shipping City'),
          state: pick(r, 'Shipping Province Name', 'Shipping Province'),
          pincode: pick(r, 'Shipping Zip'),
        },
        items: [],
        subtotal: money(pick(r, 'Subtotal')),
        shipping: money(pick(r, 'Shipping')),
        discount: money(pick(r, 'Discount Amount')),
        total: money(pick(r, 'Total')),
        notes: pick(r, 'Note'),
        courier: '',
        awb: '',
        source: 'Shopify',
        timeline: [{ status: 'placed', at: new Date(created).toISOString() }],
      });
    }

    const title = pick(r, 'Lineitem name');
    if (title) {
      const o = byNumber.get(number);
      o.items.push({
        name: title,
        sku: pick(r, 'Lineitem sku'),
        qty: Number(pick(r, 'Lineitem quantity')) || 1,
        price: money(pick(r, 'Lineitem price')),
        /* Matched to a catalogue product below, by SKU then by name. */
        productId: null,
      });
    }
  }
  return [...byNumber.values()];
}

/** Links CSV line items to the products already imported, so stock and sales
    figures line up. Unmatched items keep their name and are simply not linked. */
function linkProducts(orders, products) {
  const bySku = new Map(products.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p.id]));
  const byName = new Map(products.map((p) => [String(p.name).toLowerCase().trim(), p.id]));
  let linked = 0, missed = 0;
  for (const o of orders) {
    for (const it of o.items) {
      const id = bySku.get(String(it.sku).toLowerCase()) || byName.get(String(it.name).toLowerCase().trim());
      if (id) { it.productId = id; linked++; } else missed++;
    }
  }
  return { linked, missed };
}

/* ----------------------------------------------------------------- main */

const customersFile = str('customers');
const ordersFile = str('orders');

if (!customersFile && !ordersFile) {
  console.error(`
Usage:
  node import-csv.js --customers customers_export.csv
  node import-csv.js --orders orders_export.csv
  node import-csv.js --customers c.csv --orders o.csv --dry-run

Export these from your Shopify admin:
  Customers > Export > All customers
  Orders    > Export > All orders
`);
  process.exit(1);
}

for (const f of [customersFile, ordersFile].filter(Boolean)) {
  if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
}

const info = await initDb();
console.log(`\nImporting Shopify CSV${DRY ? '  (DRY RUN, nothing written)' : ''}`);
console.log(`  store: ${info.mode}${info.db ? ` (${info.db})` : ''}\n`);

let nextCustomers = null;
let nextOrders = null;

if (customersFile) {
  const { headers, rows } = readCsv(customersFile);
  const built = buildCustomers(rows);
  console.log(`  ${path.basename(customersFile)}`);
  console.log(`    ${rows.length} row(s), ${headers.length} column(s) -> ${built.length} customer(s)`);

  /* Merge on email so a re-run updates rather than duplicating, and so a
     customer who already registered on the new site keeps their password. */
  const existing = db.customers || [];
  const byEmail = new Map(existing.map((c) => [(c.email || '').toLowerCase(), c]));
  let added = 0, merged = 0;
  nextCustomers = [...existing];
  for (const c of built) {
    const prev = c.email && byEmail.get(c.email);
    if (prev) {
      Object.assign(prev, { ...c, id: prev.id, passwordHash: prev.passwordHash, epoch: prev.epoch, createdAt: prev.createdAt });
      merged++;
    } else {
      nextCustomers.push({ ...c, id: uid('cus') });
      added++;
    }
  }
  console.log(`    ${added} new, ${merged} merged into existing\n`);
}

if (ordersFile) {
  const { headers, rows } = readCsv(ordersFile);
  const built = buildOrders(rows);
  const link = linkProducts(built, db.products || []);
  console.log(`  ${path.basename(ordersFile)}`);
  console.log(`    ${rows.length} line-item row(s), ${headers.length} column(s) -> ${built.length} order(s)`);
  console.log(`    line items linked to catalogue: ${link.linked}, unmatched: ${link.missed}`);
  const revenue = built.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  console.log(`    revenue represented: ₹${revenue.toLocaleString('en-IN')}\n`);

  const existing = db.orders || [];
  const seen = new Set(existing.map((o) => o.number));
  nextOrders = [...existing, ...built.filter((o) => !seen.has(o.number))];
  console.log(`    ${built.filter((o) => !seen.has(o.number)).length} new, ${built.filter((o) => seen.has(o.number)).length} already present\n`);
}

if (DRY) {
  console.log('Dry run — nothing written. Re-run without --dry-run to apply.\n');
  await closeDb();
  process.exit(0);
}

if (nextCustomers) db.customers = nextCustomers;
if (nextOrders) db.orders = nextOrders;
await saveNow();
await closeDb();

console.log('  Done. RESTART THE SERVER to serve this.');
console.log('  The API holds every collection in memory from boot.\n');
