/* Replaces the seeded demo campaign content with Sukoon's real messaging.
 *
 *   node seed-storefront.js            # apply
 *   node seed-storefront.js --dry-run  # show what would change
 *
 * Safe to re-run: it matches on the ids it creates, so a second run updates
 * rather than duplicates. Anything the owner has since added by hand is left
 * alone, and their edits to these rows are preserved unless --force is given.
 */
import './env.js';
import { initDb, closeDb, db, saveNow } from './db.js';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');

const info = await initDb();
console.log(`\nSeeding storefront content${DRY ? '  (DRY RUN)' : ''}`);
console.log(`  store: ${info.mode}${info.db ? ` (${info.db})` : ''}\n`);

/* ------------------------------------------------ rotating announcements */

/* The three lines Sukoon asked to cycle in the top strip. Stored as banners so
   they can be edited, reordered or switched off from Admin → Banners. */
const TICKER = [
  {
    id: 'bnr_ticker_custom',
    title: 'Custom bracelets',
    message: 'For customisation of bracelets, connect with us on +91 90122 57555',
    cta: 'Talk to us', link: '/contact', code: '',
  },
  {
    id: 'bnr_ticker_first',
    title: 'First order',
    message: 'Enjoy 10% off your first order',
    cta: 'Shop now', link: '/shop', code: 'SUKOON10',
  },
  {
    id: 'bnr_ticker_cod',
    title: 'Cash on delivery',
    message: 'COD available on orders above ₹500, after a ₹200 prepaid advance',
    cta: 'How it works', link: '/shipping-policy', code: '',
  },
].map((b, i) => ({
  ...b,
  subtitle: '',
  palette: 'auto',
  placement: 'top',
  active: true,
  image: '',
  order: i,
  startDate: '',
  endDate: '',
  createdAt: new Date().toISOString(),
}));

/* ------------------------------------------------------------ hero slides */

/* Placeholder banner artwork.
 *
 * The hero is a wide inset card, so a slide wants a 21:9 banner. Sukoon will
 * generate finished banners and upload them through Admin -> Homepage carousel;
 * until then Cloudinary composes one: the square catalogue photo is placed at
 * the right edge (`g_east`) and the rest of the 21:9 canvas is padded with the
 * ivory ground, which leaves clean space on the left for the copy. Cropping a
 * square photo to 21:9 instead would throw the product away.
 */
const BANNER = (id) =>
  `https://res.cloudinary.com/enf4l41d/image/upload/c_pad,g_east,w_2200,h_943,b_rgb:f2ece1,f_auto,q_auto/${id}`;

/* Phones get 4:5 of the same shot rather than a 60px sliver of the wide crop. */
const BANNER_MOBILE = (id) =>
  `https://res.cloudinary.com/enf4l41d/image/upload/c_pad,g_south,w_900,h_1125,b_rgb:f2ece1,f_auto,q_auto/${id}`;

function buildSlides(products) {
  const used = new Set();
  const pick = (category) => {
    const p = products.find((x) => x.category === category && x.images?.length && !used.has(x.id));
    if (!p?.images?.[0]) return { image: '', mobileImage: '' };
    used.add(p.id);
    const id = p.images[0].split('/upload/')[1]?.replace(/^[^/]*\//, '');
    if (!id) return { image: p.images[0], mobileImage: p.images[0] };
    return { image: BANNER(id), mobileImage: BANNER_MOBILE(id) };
  };

  return [
    {
      id: 'sld_brand',
      eyebrow: 'Certified astrologer · 10+ years',
      title: 'Stones chosen for you,\nnot for a shelf',
      subtitle: 'Swati reads your chart first, then recommends the stone. Every piece is genuine, and energised by hand in our Meerut studio before it ships.',
      cta: 'Explore the collection', link: '/shop',
      ...pick('zodiac-bracelets'), align: 'left', tone: 'light', order: 0,
    },
    {
      id: 'sld_offer',
      eyebrow: '10% off your first order',
      title: 'Begin with\nsomething chosen',
      subtitle: 'Use code SUKOON10 at checkout. Cash on delivery on orders above ₹500, with a ₹200 advance paid online.',
      cta: 'Shop the collection', link: '/shop',
      ...pick('wellness-bracelets'), align: 'left', tone: 'light', order: 1,
    },
    {
      id: 'sld_rudraksha',
      eyebrow: 'Authentic Rudraksha',
      title: 'Beads that carry\na blessing',
      subtitle: 'Sourced whole — never split, never dyed. Strung by hand and charged with mantra before they reach you.',
      cta: 'See Rudraksha', link: '/shop/rudraksha',
      ...pick('rudraksha'), align: 'left', tone: 'light', order: 2,
    },
  ].map((s) => ({
    ...s, active: true, startDate: '', endDate: '',
    createdAt: new Date().toISOString(),
  }));
}

/* ---------------------------------------------------------------- apply */

const slides = buildSlides(db.products || []);
const mine = new Set([...TICKER, ...slides].map((x) => x.id));

/* Demo campaign banners the seeder invented. Retired, not deleted, so nothing
   the owner might still want is destroyed. */
const demoTop = (db.banners || []).filter((b) => !mine.has(b.id) && b.placement === 'top' && b.active);

console.log('  announcements (top strip):');
TICKER.forEach((b) => console.log(`    ${b.id.padEnd(20)} ${b.message.slice(0, 62)}`));
if (demoTop.length) {
  console.log('\n  retiring seeded demo banners (kept, set inactive):');
  demoTop.forEach((b) => console.log(`    ${b.title}`));
}
console.log('\n  hero slides:');
slides.forEach((s) => console.log(`    ${s.id.padEnd(16)} ${s.title.split('\n')[0].padEnd(28)} ${s.image ? 'photo' : 'brand card'}`));

if (DRY) {
  console.log('\nDry run — nothing written.\n');
  await closeDb();
  process.exit(0);
}

const keepBanner = (existing, next) =>
  existing && !FORCE ? { ...next, ...existing, active: true, placement: 'top' } : next;

db.banners = [
  ...TICKER.map((b) => keepBanner((db.banners || []).find((x) => x.id === b.id), b)),
  ...(db.banners || [])
    .filter((b) => !mine.has(b.id))
    .map((b) => (b.placement === 'top' && b.active ? { ...b, active: false } : b)),
];

db.slides = [
  ...slides.map((s) => {
    const existing = (db.slides || []).find((x) => x.id === s.id);
    return existing && !FORCE ? { ...s, ...existing } : s;
  }),
  ...(db.slides || []).filter((s) => !mine.has(s.id)),
];

await saveNow();
await closeDb();
console.log('\n  Done. RESTART THE SERVER to serve this.');
console.log('  The API holds every collection in memory from boot, so a write made');
console.log('  from another process stays invisible until it reloads.\n');
