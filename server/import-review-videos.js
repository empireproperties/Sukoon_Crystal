/* Moves review clips off someone else's CDN and into our own R2 bucket.
 *
 *   node server/import-review-videos.js                 # the list below
 *   node server/import-review-videos.js <url> <url> ... # or your own
 *   node server/import-review-videos.js --dry-run       # just say what it would do
 *
 * Why copy them at all: the source URLs point at the old Shopify store. That
 * store can be closed, its CDN links can be rotated, and every play is served
 * by a shop we no longer control. R2 costs nothing for egress, and the same
 * bucket already holds the clips customers upload themselves.
 *
 * Prints the R2 URL for each clip. Nothing is attached to a review here --
 * paste a URL into Admin > Reviews > Add a review, pick the bracelet it is
 * about, and publish. Deliberately manual: only a person knows which clip is
 * about which product, and which ones are worth showing.
 *
 * Safe to run twice. Each run writes new objects with fresh random keys, so a
 * repeat costs a little storage but cannot overwrite or break anything.
 */
import './env.js';
import { configureR2, uploadVideoToR2 } from './r2.js';

const DEFAULT_URLS = [
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/1430d2f689094da4aa98bf5e9baf2616/1430d2f689094da4aa98bf5e9baf2616.HD-1080p-2.5Mbps-57404811.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/875adfa284de4ef5a592c9725d0f96a2/875adfa284de4ef5a592c9725d0f96a2.HD-1080p-7.2Mbps-58548634.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/2dd72329579e4ef689a2bafdac1ff1cd/2dd72329579e4ef689a2bafdac1ff1cd.HD-1080p-7.2Mbps-58548768.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/856819cf6578452cb7e9a704a19ca450/856819cf6578452cb7e9a704a19ca450.HD-720p-1.6Mbps-57404810.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/fe994acf15374c128440ecc2c8d681a3/fe994acf15374c128440ecc2c8d681a3.HD-1080p-7.2Mbps-57990577.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/830db64a844f4d2180fddae075912960/830db64a844f4d2180fddae075912960.HD-1080p-7.2Mbps-58548401.mp4?v=0',
  'https://sukoon-crystalsolutions.com/cdn/shop/videos/c/vp/37d15a643e6a45c5a73c9b59c86194ef/37d15a643e6a45c5a73c9b59c86194ef.HD-1080p-7.2Mbps-57990296.mp4?v=0',
];

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/* The same clip was sent more than once in the original list. Uploading it
   twice would put two copies in the bucket under different keys, and the
   homepage would play the same review as if it were two people. */
const unique = (urls) => [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const urls = unique(args.filter((a) => !a.startsWith('--')).length
    ? args.filter((a) => !a.startsWith('--'))
    : DEFAULT_URLS);

  const r2 = configureR2();
  if (!r2.configured && !dryRun) {
    console.error('R2 is not configured. Set the five R2_* variables in server/.env (see DEPLOY.md).');
    process.exit(1);
  }

  console.log(`\n  ${urls.length} clip(s) to copy into R2${dryRun ? '  (dry run)' : ` bucket ${r2.bucket}`}\n`);

  const done = [];
  const failed = [];

  for (const [i, url] of urls.entries()) {
    const label = `  ${i + 1}/${urls.length}`;
    if (dryRun) { console.log(`${label}  would copy  ${url}`); continue; }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`source responded ${res.status}`);

      /* Buffered rather than streamed: R2's PutObject needs the length up
         front, and these are phone clips of a few tens of megabytes. */
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = (res.headers.get('content-type') || 'video/mp4').split(';')[0];

      const stored = await uploadVideoToR2(buffer, { contentType });
      done.push(stored);
      console.log(`${label}  ${mb(stored.bytes)}  ->  ${stored.url}`);
    } catch (e) {
      failed.push({ url, error: e.message });
      console.error(`${label}  FAILED  ${url}\n        ${e.message}`);
    }
  }

  if (dryRun) return;

  console.log(`\n  ${done.length} uploaded, ${failed.length} failed`);
  if (done.length) {
    console.log('\n  Paste these into Admin > Reviews > Add a review, one per clip:\n');
    for (const d of done) console.log(`    ${d.url}`);
    console.log('');
  }
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
