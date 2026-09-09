/* Cloudflare R2 — where customer review videos live.
 *
 * WHY R2 AND NOT CLOUDINARY
 * Cloudinary is already wired up for images and it handles video too, so this
 * module exists for one reason: egress. Cloudinary's free tier bills bandwidth
 * against a shared credit pool, and a single 30-second review clip re-watched a
 * few thousand times costs more of that pool than the entire product catalogue.
 * R2 charges nothing for egress at all. Storage is the cheap part of video;
 * serving it is the expensive part, so video goes here and images stay there.
 *
 * The store never breaks when this is unconfigured — index.js falls back to
 * Cloudinary, then to local disk. Only the cost profile changes.
 *
 * Credentials come from server/.env:
 *   R2_ACCOUNT_ID          Cloudflare dashboard > R2 > the id in the S3 endpoint
 *   R2_ACCESS_KEY_ID       R2 > Manage API tokens > Create (Object Read & Write)
 *   R2_SECRET_ACCESS_KEY   shown once when the token is created
 *   R2_BUCKET              the bucket name
 *   R2_PUBLIC_BASE         the bucket's public URL, r2.dev or a custom domain
 *
 * R2_PUBLIC_BASE is not optional. A bucket with no public access serves nothing
 * a browser can play, and an upload whose URL 404s is worse than no upload, so
 * configureR2() reports itself unconfigured without it rather than writing
 * objects nobody can reach.
 */
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/* Read at call time, never at import time -- env.js may load after this module. */
const env = (k) => (process.env[k] || '').trim();

const PREFIX = () => env('R2_PREFIX') || 'reviews';

let client = null;
let settings = { configured: false, bucket: '', publicBase: '' };

export function configureR2() {
  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET');
  const publicBase = env('R2_PUBLIC_BASE').replace(/\/+$/, '');

  if (!(accountId && accessKeyId && secretAccessKey && bucket && publicBase)) {
    settings = { configured: false, bucket: '', publicBase: '' };
    client = null;
    return settings;
  }

  client = new S3Client({
    /* R2 ignores the region but the SDK insists on one being set. */
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  settings = { configured: true, bucket, publicBase };
  return settings;
}

/** The public URL of a stored object. Exported so a saved key can be re-resolved
 *  if the bucket ever moves to a custom domain. */
export const publicUrlFor = (key) => `${settings.publicBase}/${key}`;

/** True for a URL this bucket serves. Used to decide whether a review's video is
 *  ours to delete along with the review. */
export const isOurs = (url) =>
  Boolean(settings.publicBase) && String(url || '').startsWith(`${settings.publicBase}/`);

/** The object key behind one of our public URLs.
 *
 *  Deriving the key rather than letting the client tell us what it is: a review
 *  is submitted by an anonymous visitor, and a client-supplied key would be a
 *  request to delete an arbitrary object the next time that review was removed. */
export const keyFromUrl = (url) =>
  (isOurs(url) ? decodeURIComponent(String(url).slice(settings.publicBase.length + 1).split('?')[0]) : null);

/* Extensions we are willing to put in a key, keyed by the mime type multer
   already validated. A key is never built from the client's filename extension:
   that string is attacker-controlled and ends up in a URL we serve. */
const EXT = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mp4',        /* .mov is an MP4 container; browsers play it as one */
  'video/webm': 'webm',
  'video/x-m4v': 'mp4',
};

/**
 * Stores one video and returns its public URL.
 *
 * The key is `<prefix>/<yyyy-mm>/<random>.<ext>`: random because two reviewers
 * filming on the same phone model send the same filename, and dated so a year
 * of clips can be lifecycle-expired or audited a month at a time.
 */
export async function uploadVideoToR2(buffer, { contentType }) {
  if (!client) throw new Error('R2 is not configured.');

  const ext = EXT[contentType] || 'mp4';
  const month = new Date().toISOString().slice(0, 7);
  const key = `${PREFIX()}/${month}/${crypto.randomBytes(12).toString('hex')}.${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: settings.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    /* A review clip is immutable once uploaded and the key is unguessable, so
       it can be cached hard. This is the whole point of putting it on R2. */
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { url: publicUrlFor(key), key, bytes: buffer.length, storage: 'r2' };
}

/** Best-effort cleanup when a review is deleted. Never throws: an orphaned
 *  object costs a fraction of a cent, a failed delete must not block the admin. */
export async function deleteFromR2(key) {
  if (!client || !key) return false;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
