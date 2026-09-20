/* Clears the order history and everything counted from it.
 *
 *   node server/reset-orders.js --dry-run   # show what would go, write nothing
 *   node server/reset-orders.js             # do it (writes a backup first)
 *
 * For the end of testing: the shop has been ordered from by its own owner to
 * prove the checkout works, and those orders are now sitting in the revenue
 * figures as though they were trade.
 *
 * What goes:
 *   - every order
 *   - every payment intent (the Razorpay session rows behind them)
 *   - `sold` on every product, back to 0
 *   - `used` on every coupon, back to 0
 *
 * What stays: products, customers and their accounts, reviews, bookings,
 * categories, pages, banners, settings, admins. Nothing here touches them.
 *
 * A JSON backup of what is removed is written to server/backups/ first, so a
 * mistake is recoverable. The live API keeps the whole dataset in memory from
 * boot, so it will go on showing the old orders until it restarts -- redeploy
 * it, or restart the process, once this has run.
 */
import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb, saveNow } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

const info = await initDb();
console.log(`\n  store: ${info.mode}${info.db ? ` (${info.db})` : ''}${DRY ? '   (DRY RUN, nothing written)' : ''}\n`);

const orders = db.orders || [];
const payments = db.payments || [];
const soldProducts = (db.products || []).filter((p) => Number(p.sold) > 0);
const usedCoupons = (db.coupons || []).filter((c) => Number(c.used) > 0);

const revenue = orders
  .filter((o) => o.status !== 'cancelled')
  .reduce((t, o) => t + (Number(o.total) || 0), 0);

console.log(`  orders          ${orders.length}  (revenue Rs ${revenue})`);
for (const o of orders) {
  console.log(`      ${o.number}  ${String(o.createdAt).slice(0, 10)}  ${o.customer?.name || '?'}  Rs ${o.total}  ${o.status}`);
}
console.log(`  payment rows    ${payments.length}`);
console.log(`  products sold   ${soldProducts.length}${soldProducts.length ? `  (${soldProducts.map((p) => `${p.name.slice(0, 28)}=${p.sold}`).join(', ')})` : ''}`);
console.log(`  coupons used    ${usedCoupons.length}${usedCoupons.length ? `  (${usedCoupons.map((c) => `${c.code}=${c.used}`).join(', ')})` : ''}`);
console.log('\n  kept: products, customers, reviews, bookings, pages, banners, settings, admins');

if (DRY) {
  console.log('\n  Dry run. Nothing was written.\n');
  process.exit(0);
}

if (!orders.length && !payments.length && !soldProducts.length && !usedCoupons.length) {
  console.log('\n  Already clear. Nothing to do.\n');
  process.exit(0);
}

/* Backup before the delete, not after. */
const dir = path.join(__dirname, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(dir, `orders-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({
  takenAt: new Date().toISOString(),
  orders,
  payments,
  sold: soldProducts.map((p) => ({ id: p.id, name: p.name, sold: p.sold })),
  coupons: usedCoupons.map((c) => ({ id: c.id, code: c.code, used: c.used })),
}, null, 2));
console.log(`\n  backup written: ${path.relative(process.cwd(), file)}`);

db.orders = [];
db.payments = [];
for (const p of db.products || []) if (Number(p.sold) > 0) p.sold = 0;
for (const c of db.coupons || []) if (Number(c.used) > 0) c.used = 0;

await saveNow();

console.log('  cleared. Restart or redeploy the API so it stops serving the old figures from memory.\n');
process.exit(0);
