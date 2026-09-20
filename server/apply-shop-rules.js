/* Applies the shop's trading rules to the live settings.
 *
 *   node server/apply-shop-rules.js --dry-run
 *   node server/apply-shop-rules.js
 *
 * Both rules are editable in the admin -- delivery under Appearance, the
 * consultation switch under Consultations. This exists so they can be set
 * once, correctly, rather than remembered.
 *
 * The live API reads settings from the copy it loaded at boot, so restart or
 * redeploy it after running this.
 */
import './env.js';
import { db, initDb, saveNow } from './db.js';

const DRY = process.argv.includes('--dry-run');

/* Free delivery above Rs 600, Rs 49 below it. */
const DELIVERY = { fee: 49, freeAbove: 600, removeAbove: true };

const info = await initDb();
console.log(`\n  store: ${info.mode}${info.db ? ` (${info.db})` : ''}${DRY ? '   (DRY RUN)' : ''}\n`);

const current = db.settings?.delivery || {};
const deliveryChanged = ['fee', 'freeAbove', 'removeAbove'].some((k) => current[k] !== DELIVERY[k]);
console.log(`  delivery   now: ${JSON.stringify(current)}`);
console.log(`             set: ${JSON.stringify(DELIVERY)}${deliveryChanged ? '' : '   (already set)'}`);

/* Anything given away is for customers. A paid consultation stays open to
   everyone -- that is a sale, not a gift. */
const free = (db.services || []).filter((s) => !Number(s.price));
const toLock = free.filter((s) => !s.requiresPurchase);
console.log(`\n  free consultations:   ${free.length ? free.map((s) => s.name).join(', ') : 'none'}`);
console.log(`  to lock to customers: ${toLock.length ? toLock.map((s) => s.name).join(', ') : 'none (already locked)'}`);

if (DRY) { console.log('\n  Dry run. Nothing written.\n'); process.exit(0); }
if (!deliveryChanged && !toLock.length) { console.log('\n  Already applied. Nothing to do.\n'); process.exit(0); }

db.settings = { ...db.settings, delivery: { ...current, ...DELIVERY } };
for (const s of toLock) s.requiresPurchase = true;
await saveNow();

console.log('\n  applied. Restart or redeploy the API so it reads the new settings.\n');
process.exit(0);
