/* Promotes the personalised bracelet to the front of the shop.
 *
 *   node server/feature-personalised-bracelet.js
 *   node server/feature-personalised-bracelet.js --dry-run
 *
 * Three things, all of which the admin can also do by hand:
 *   bestseller  -- the flag the card reads
 *   position 0  -- first in the shop's own order (see byShopOrder in index.js)
 *   celebrate   -- adding it to the cart opens the birth chart and the
 *                  consultation call, which is the path this piece exists for
 *
 * Idempotent: it sets these three and touches nothing else.
 */
import './env.js';
import { db, initDb, saveNow } from './db.js';

const SLUG = 'personalised-crystal-energy-bracelet';

const WANTED = { bestseller: true, position: 0, celebrate: true };

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const store = await initDb();
  console.log(`\n  store: ${store.mode}${store.db ? ` (${store.db})` : ''}`);

  const p = (db.products || []).find((x) => x.slug === SLUG);
  if (!p) {
    console.error(`  no product with slug "${SLUG}". Check the address of the product page.`);
    process.exit(1);
  }

  const patch = {};
  for (const [k, v] of Object.entries(WANTED)) if (p[k] !== v) patch[k] = v;

  if (!Object.keys(patch).length) {
    console.log(`  ${p.name} is already featured. Nothing to do.\n`);
    return;
  }

  if (dryRun) {
    console.log(`  would update ${p.id} (${p.name}): ${JSON.stringify(patch)}\n`);
    return;
  }

  Object.assign(p, patch);
  await saveNow();
  console.log(`  updated ${p.id} (${p.name}): ${JSON.stringify(patch)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
