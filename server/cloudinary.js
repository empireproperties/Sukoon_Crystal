/* Moves Shopify-hosted images onto Cloudinary.
 *
 * Cloudinary fetches the remote URL itself, so nothing is downloaded here --
 * we hand it the Shopify CDN link and it pulls the bytes server-side.
 *
 * Credentials come from server/.env:
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 * or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 */
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

const FOLDER = process.env.CLOUDINARY_FOLDER || 'sukoon';
const SHOPIFY_CDN = /https?:\/\/cdn\.shopify\.com\/[^\s"'\\)]+/g;

export function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });          /* SDK parses CLOUDINARY_URL itself */
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  const { cloud_name: cloud, api_key: key } = cloudinary.config();
  return { configured: Boolean(cloud && key), cloud };
}

/** Deterministic id from the source URL, so a re-run finds the same asset. */
function publicIdFor(url) {
  const clean = url.split('?')[0];
  const base = decodeURIComponent(clean.split('/').pop() || 'image').replace(/\.[^.]+$/, '');
  const safe = base.replace(/[^\w-]/g, '_').slice(-60);
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
  return `${FOLDER}/${hash}-${safe}`;
}

/* f_auto picks webp/avif per browser, q_auto picks the quality. Both are applied
   at delivery, so one stored original serves every device and format. */
const DELIVERY = process.env.CLOUDINARY_TRANSFORM || 'f_auto,q_auto,w_1200';

const withTransform = (secureUrl) =>
  DELIVERY ? secureUrl.replace('/upload/', `/upload/${DELIVERY}/`) : secureUrl;

/**
 * Uploads a remote URL into Cloudinary. `overwrite: false` plus a deterministic
 * public_id makes this idempotent -- an existing asset is returned as-is.
 */
export async function uploadFromUrl(url, { retries = 3 } = {}) {
  const public_id = publicIdFor(url);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await cloudinary.uploader.upload(url, {
        public_id,
        overwrite: false,
        resource_type: 'image',
        unique_filename: false,
        use_filename: false,
      });
      return {
        url: withTransform(res.secure_url),
        bytes: res.bytes || 0,
        reused: res.existing === true,
      };
    } catch (e) {
      const msg = e?.message || String(e);
      if (attempt >= retries || /Invalid|not allowed|401|403/i.test(msg)) throw new Error(msg);
      await new Promise((r) => setTimeout(r, attempt * 900));
    }
  }
}

/**
 * Uploads raw bytes (an admin's file picker upload) straight to Cloudinary,
 * so nothing depends on the server's local disk surviving a redeploy.
 * Unlike uploadFromUrl this lets Cloudinary assign a unique id -- two different
 * files genuinely named "crystal.jpg" must not collide.
 */
export function uploadBuffer(buffer, { filename, folder = FOLDER } = {}) {
  const base = (filename || 'upload').replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_').slice(-60);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        use_filename: true,
        filename_override: base,
        unique_filename: true,
      },
      (err, res) =>
        err ? reject(new Error(err.message || String(err)))
            : resolve({ url: withTransform(res.secure_url), publicId: res.public_id, bytes: res.bytes })
    );
    stream.end(buffer);
  });
}

/* Same deep walk as the local downloader: find every CDN URL, then rewrite. */
function collectUrls(node, out = new Set()) {
  if (typeof node === 'string') {
    for (const m of node.match(SHOPIFY_CDN) || []) out.add(m);
  } else if (Array.isArray(node)) node.forEach((n) => collectUrls(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectUrls(n, out));
  return out;
}

function rewrite(node, map) {
  if (typeof node === 'string') return node.replace(SHOPIFY_CDN, (m) => map.get(m) || m);
  if (Array.isArray(node)) return node.map((n) => rewrite(n, map));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewrite(v, map)]));
  }
  return node;
}

async function pool(items, limit, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    })
  );
}

/**
 * Replaces every Shopify image reference in `dbRef` with a Cloudinary URL.
 * Mutates in place; a failed upload keeps its original URL.
 */
export async function migrateImagesToCloudinary(dbRef, { concurrency = 4, dryRun = false, log = console.log } = {}) {
  const urls = [...collectUrls(dbRef)];
  if (!urls.length) return { total: 0, uploaded: 0, failed: [], bytes: 0 };

  log(`  ${urls.length} distinct Shopify image(s) to move to Cloudinary`);
  if (dryRun) return { total: urls.length, uploaded: 0, failed: [], bytes: 0, dryRun: true };

  const map = new Map();
  const failed = [];
  let uploaded = 0;
  let bytes = 0;
  let done = 0;

  /* Cloudinary's free tier rate-limits concurrent uploads; 4 is comfortable. */
  await pool(urls, concurrency, async (url) => {
    try {
      const res = await uploadFromUrl(url);
      map.set(url, res.url);
      uploaded++;
      bytes += res.bytes;
    } catch (e) {
      failed.push({ url, error: e.message });
    }
    if (++done % 20 === 0 || done === urls.length) log(`    ${done}/${urls.length}`);
  });

  const updated = rewrite(dbRef, map);
  for (const key of Object.keys(updated)) dbRef[key] = updated[key];

  return { total: urls.length, uploaded, failed, bytes };
}

export { cloudinary };
