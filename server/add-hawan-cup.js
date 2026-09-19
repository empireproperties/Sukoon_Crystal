/* Creates the Hawan Cup launch product.
 *
 *   node server/add-hawan-cup.js            # create it (inactive)
 *   node server/add-hawan-cup.js --dry-run  # say what it would do
 *
 * Created INACTIVE on purpose. A product with no photographs renders as a
 * lettered grey tile across the shop, and this one's photographs are on the
 * owner's machine, not here. Add them in Admin > Products, attach the clip,
 * then switch it Active -- one toggle, and the launch goes live looking like
 * a launch.
 *
 * Idempotent: a product on this slug is left alone rather than duplicated.
 */
import './env.js';
import { db, initDb, saveNow, uid } from './db.js';

const SLUG = 'sukoon-hawan-cup';

const PRODUCT = {
  slug: SLUG,
  name: 'Sukoon Hawan Cup — 9 Pure Herbal Cups',
  category: 'sukoon-special',
  /* Launch offer: every second box is free, worked out by the server in
     priceCart. ₹200 a box, so two boxes cost ₹200 and four cost ₹400. The MRP
     is the pair's shelf worth, which is what the free box is worth. */
  price: 200,
  mrp: 400,
  bogo: true,
  stock: 100,
  stone: 'Cow dung, ghee, havan samagri',
  description:
    'Nine ready-to-light havan cups, pressed from cow dung, desi ghee and temple-grade '
    + 'havan samagri. No charcoal, no chopping wood, no smoke that stings: set one in the '
    + 'clay holder, light the rim, and the cup carries the havan on its own for about '
    + 'twenty minutes. Made for a weekday morning at a home mandir, not only for a festival.',
  benefits: [
    'Nine pressed cups in every box, plus a clay holder',
    'Cow dung, desi ghee and herbal samagri — nothing synthetic',
    'Lights in seconds and burns for around twenty minutes',
    'Clears the air of a room the way an agarbatti cannot',
    'Ash is fertiliser: it belongs in a plant pot, not a bin',
  ],
  chakra: 'Root',
  element: 'Fire',
  zodiac: [],
  images: [],
  /* The clip is attached in Admin > Products. */
  video: null,
  /* Consumable and lit on arrival, so it cannot come back. The storefront says
     so on the product page and the returns route refuses it outright. */
  returnable: false,
  featured: true,
  bestseller: false,
  /* Photographs first. See the note at the top. */
  active: false,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const store = await initDb();
  console.log(`\n  store: ${store.mode}${store.db ? ` (${store.db})` : ''}`);

  /* Already created? Bring the launch terms into line rather than refusing to
     act or making a second one. Only the terms -- the photographs, the clip
     and whether it is live are the owner's to set, and a re-run must not
     stamp on them. */
  const existing = (db.products || []).find((p) => p.slug === SLUG);
  if (existing) {
    const patch = {};
    for (const key of ['price', 'mrp', 'bogo', 'returnable']) {
      if (existing[key] !== PRODUCT[key]) patch[key] = PRODUCT[key];
    }
    if (!Object.keys(patch).length) {
      console.log(`  already there and correct: ${existing.id} (${existing.active ? 'active' : 'inactive'}).\n`);
      return;
    }
    if (dryRun) {
      console.log(`  would update ${existing.id}: ${JSON.stringify(patch)}\n`);
      return;
    }
    Object.assign(existing, patch);
    await saveNow();
    console.log(`  updated ${existing.id}: ${JSON.stringify(patch)}\n`);
    return;
  }

  if (dryRun) {
    console.log(`  would add "${PRODUCT.name}" at ₹${PRODUCT.price}, inactive, no photos yet.\n`);
    return;
  }

  const product = {
    id: uid('prd'),
    rating: 0,
    reviews: 0,
    sold: 0,
    sku: `SKN-${String((db.products || []).length + 101).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    ...PRODUCT,
  };

  db.products = [product, ...(db.products || [])];
  await saveNow();

  console.log(`  added ${product.id}  ${product.name}`);
  console.log('\n  Next, in Admin > Products:');
  console.log('    1. open it and upload the three photographs');
  console.log('    2. attach the clip under Product video');
  console.log('    3. switch it Active\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
