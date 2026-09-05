/* Pulls every Shopify-hosted image into server/uploads/shopify/ and rewrites
 * db.json to point at the local copies.
 *
 *   node download-images.js --dry-run
 *   node download-images.js
 *
 * Run this while the Shopify store is still live. Once the plan lapses the CDN
 * stops serving these files and the images are gone for good.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { load, saveNow } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const IMAGE_DIR = path.join(__dirname, 'uploads', 'shopify');

const SHOPIFY_CDN = /https?:\/\/cdn\.shopify\.com\/[^\s"'\\)]+/g;

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/avif': '.avif', 'image/svg+xml': '.svg',
};

/** Stable local name: original basename, prefixed with a hash of the full URL
 *  so two files that share a name in different folders never collide. */
function localName(url) {
  const clean = url.split('?')[0];
  const base = decodeURIComponent(path.basename(clean)) || 'image';
  const safe = base.replace(/[^\w.-]/g, '_').slice(-80);
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
  return `${hash}-${safe}`;
}

/** Walks any nested structure and collects every Shopify CDN URL it finds. */
function collectUrls(node, out = new Set()) {
  if (typeof node === 'string') {
    for (const m of node.match(SHOPIFY_CDN) || []) out.add(m);
  } else if (Array.isArray(node)) {
    node.forEach((n) => collectUrls(n, out));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach((n) => collectUrls(n, out));
  }
  return out;
}

/** Same walk, rewriting strings through the URL map. Returns a new structure. */
function rewrite(node, map) {
  if (typeof node === 'string') {
    return node.replace(SHOPIFY_CDN, (m) => map.get(m) || m);
  }
  if (Array.isArray(node)) return node.map((n) => rewrite(n, map));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewrite(v, map)]));
  }
  return node;
}

/** Shopify's CDN resizes via ?width= on the URL. It does NOT honour a
 *  ?format= parameter -- transcoding is content-negotiated, so webp comes from
 *  the Accept header instead. That distinction is worth ~8x on file size. */
function transferUrl(url, width) {
  if (!width) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('width', String(width));
    return u.toString();
  } catch {
    return url;
  }
}

const acceptFor = (format) =>
  format === 'webp' ? 'image/webp,image/*;q=0.8,*/*;q=0.5'
  : format === 'avif' ? 'image/avif,image/webp;q=0.9,image/*;q=0.8,*/*;q=0.5'
  : 'image/*,*/*;q=0.8';

async function downloadOne(url, { retries = 3, width, format } = {}) {
  const src = transferUrl(url, width);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(src, { headers: { 'User-Agent': 'sukoon-importer', Accept: acceptFor(format) } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty response');

      /* Trust the served content type over the URL's extension -- a .png URL
         negotiated down to webp must not be saved as "name.png.webp". */
      let name = localName(url);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      const wanted = EXT_BY_TYPE[type];
      const current = path.extname(name).toLowerCase();
      if (wanted && current !== wanted) {
        const known = Object.values(EXT_BY_TYPE).includes(current) || current === '.jpeg';
        name = known ? `${name.slice(0, -current.length)}${wanted}` : `${name}${wanted}`;
      }

      fs.writeFileSync(path.join(IMAGE_DIR, name), buf);
      return { name, bytes: buf.length };
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, attempt * 700));
    }
  }
}

/** Simple bounded-concurrency worker pool. */
async function pool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

/**
 * Downloads every Shopify image referenced anywhere in `dbRef` and rewrites the
 * references in place. Returns a summary; does not save.
 */
export async function localiseImages(dbRef, { concurrency = 6, dryRun = false, width, format, log = console.log } = {}) {
  const urls = [...collectUrls(dbRef)];
  if (!urls.length) return { total: 0, downloaded: 0, reused: 0, failed: [], bytes: 0 };

  log(`  ${urls.length} distinct Shopify image(s) referenced`);
  if (dryRun) {
    urls.slice(0, 5).forEach((u) => log(`    would fetch ${u.slice(0, 90)}`));
    if (urls.length > 5) log(`    ...and ${urls.length - 5} more`);
    return { total: urls.length, downloaded: 0, reused: 0, failed: [], bytes: 0, dryRun: true };
  }

  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const existing = new Set(fs.readdirSync(IMAGE_DIR));
  const map = new Map();
  const failed = [];
  let downloaded = 0;
  let reused = 0;
  let bytes = 0;
  let done = 0;

  await pool(urls, concurrency, async (url) => {
    /* Match on the extension-less stem: a .png URL may already be cached as
       .webp from a previous run, and re-downloading it would be pure waste. */
    const stem = localName(url).replace(/\.[^.]+$/, '');
    const already = [...existing].find((f) => f === stem || f.startsWith(`${stem}.`));

    try {
      if (already) {
        map.set(url, `/uploads/shopify/${already}`);
        reused++;
      } else {
        const { name, bytes: n } = await downloadOne(url, { width, format });
        existing.add(name);
        map.set(url, `/uploads/shopify/${name}`);
        downloaded++;
        bytes += n;
      }
    } catch (e) {
      failed.push({ url, error: e.message });
    }
    if (++done % 20 === 0 || done === urls.length) log(`    ${done}/${urls.length}`);
  });

  /* Only rewrite what actually landed on disk -- a failed download keeps its
     original URL so nothing turns into a broken local path. */
  const updated = rewrite(dbRef, map);
  for (const key of Object.keys(updated)) dbRef[key] = updated[key];

  return { total: urls.length, downloaded, reused, failed, bytes };
}

/* ------------------------------------------------------------------ cli */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
  };
  const dryRun = process.argv.includes('--dry-run');
  const concurrency = Number(arg('concurrency', 6)) || 6;
  const width = process.argv.includes('--full') ? undefined : Number(arg('width', 1200)) || undefined;
  const format = process.argv.includes('--full') ? undefined : arg('format', 'webp');

  const dbRef = load();
  console.log(`\nLocalising Shopify images${dryRun ? '  (DRY RUN, nothing written)' : ''}`);

  console.log(`  requesting ${width ? `${width}px` : 'original size'}${format ? `, ${format} preferred` : ''} from Shopify's CDN (--full for untouched originals)`);
  const summary = await localiseImages(dbRef, { concurrency, dryRun, width, format });

  if (!summary.total) {
    console.log('  No Shopify-hosted images found -- already local.\n');
  } else if (dryRun) {
    console.log(`\nDry run -- would download ${summary.total} image(s) into uploads/shopify/.\n`);
  } else {
    saveNow(dbRef);
    const mb = (summary.bytes / 1024 / 1024).toFixed(1);
    console.log(`\n  downloaded ${summary.downloaded}, reused ${summary.reused}, ${mb} MB`);
    if (summary.failed.length) {
      console.log(`  ${summary.failed.length} FAILED (left pointing at Shopify):`);
      summary.failed.slice(0, 10).forEach((f) => console.log(`    ${f.error}  ${f.url.slice(0, 80)}`));
    }
    console.log('  db.json rewritten to /uploads/shopify/... paths\n');
  }
}
