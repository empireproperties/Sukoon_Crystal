/* Turns every clip sitting in the R2 bucket into a review awaiting review.
 *
 *   node server/seed-review-videos.js            # create the missing ones
 *   node server/seed-review-videos.js --dry-run  # just say what it would do
 *
 * The clips imported from the old Shopify store reached the bucket without
 * passing through the admin, so nothing in the database pointed at them and
 * they were invisible in every list. This puts a row in front of each one.
 *
 * They are created `pending`, which is the Awaiting review tab: a clip on its
 * own is not yet a review anyone chose to publish. Attach the bracelet it is
 * about, then press Publish.
 *
 * Idempotent. A clip that already has a review against it is skipped, so
 * running this twice cannot double up, and running it after uploading more
 * clips picks up only the new ones.
 */
import './env.js';
import { db, initDb, saveNow, uid } from './db.js';
import { configureR2, listVideos, keyFromUrl } from './r2.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const r2 = configureR2();
  if (!r2.configured) {
    console.error('R2 is not configured. Set the five R2_* variables in server/.env (see DEPLOY.md).');
    process.exit(1);
  }

  const store = await initDb();
  console.log(`\n  store: ${store.mode}${store.db ? ` (${store.db})` : ''}`);

  const clips = await listVideos({ limit: 200 });
  console.log(`  bucket: ${clips.length} clip(s) in ${r2.bucket}`);

  /* Matched on the URL rather than the key: a review created before the bucket
     moved to a custom domain still points at the same object. */
  const taken = new Set((db.reviews || []).map((r) => r.video?.url).filter(Boolean));
  const missing = clips.filter((c) => !taken.has(c.url));

  if (!missing.length) {
    console.log('  every clip already has a review. Nothing to do.\n');
    return;
  }

  console.log(`  ${missing.length} clip(s) without a review\n`);
  if (dryRun) {
    for (const c of missing) console.log(`    would add  ${c.sizeMb}MB  ${c.key}`);
    console.log('');
    return;
  }

  const now = new Date().toISOString();
  const created = missing.map((c) => ({
    id: uid('rev'),
    /* Empty on purpose. The clip is the review; a name, a rating and a
       paragraph invented here would be words nobody said. Add them in the
       admin if the customer actually gave them. */
    name: '',
    designation: '',
    rating: null,
    title: '',
    body: '',
    productId: null,
    photo: null,
    video: { kind: 'file', storage: 'r2', key: keyFromUrl(c.url), embed: c.url, url: c.url },
    status: 'pending',
    featured: false,
    source: 'admin',
    /* The upload time, not now, so the list orders the way the bucket does. */
    createdAt: c.uploadedAt ? new Date(c.uploadedAt).toISOString() : now,
  }));

  db.reviews = [...created, ...(db.reviews || [])];
  await saveNow();

  for (const r of created) console.log(`    added  ${r.id}  ${r.video.key}`);
  console.log(`\n  ${created.length} review(s) now waiting in Admin > Reviews > Awaiting review.`);
  console.log('  Attach the product to each one, then Publish.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
