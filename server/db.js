/* Storage layer.
 *
 * Three backends, picked at boot by whichever env var is set:
 *
 *   DATABASE_URL  ->  CockroachDB    (the real store)
 *   MONGODB_URI   ->  MongoDB Atlas  (legacy, kept so the old migration works)
 *   neither       ->  data/db.json   (offline dev and `npm run seed`)
 *
 * All three expose the same synchronous interface the routes already use:
 * `db.products` is a plain array, and `save()` persists whatever changed. The
 * whole dataset is held in memory (a few MB) and written back incrementally --
 * only documents that actually differ are sent to the server.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* Read at call time, never at import time -- .env may load after this module. */
const pgUri = () => process.env.DATABASE_URL || process.env.COCKROACH_URL || '';
const mongoUri = () => process.env.MONGODB_URI || '';
const mongoDbName = () => process.env.MONGODB_DB || 'sukoon';

/* CockroachDB wins when both are set, so a leftover MONGODB_URI is harmless. */
export const usingCockroach = () => Boolean(pgUri());
export const usingMongo = () => Boolean(!pgUri() && mongoUri());

const EMPTY = {
  products: [],
  orders: [],
  banners: [],
  events: [],
  bookings: [],
  visits: [],
  categories: [],
  services: [],
  customers: [],
  pages: [],
  payments: [],
  admins: [],
  reviews: [],
  coupons: [],
  slides: [],
  returns: [],
  charts: [],
  settings: { design: 'atelier', palette: 'bone', announcement: '', siteName: 'Sukoon Crystal Solutions' },
};

/* Every key above except `settings`, which is a single document. */
export const COLLECTIONS = Object.keys(EMPTY).filter((k) => k !== 'settings');
const SETTINGS_ID = 'singleton';

/* Mongo-only. The CockroachDB tables are keyed on their primary key and the
   whole dataset is read at boot, so there is no secondary lookup to index. */
const INDEXES = {
  products: [{ key: { id: 1 }, unique: true }, { key: { slug: 1 } }, { key: { shopifyId: 1 }, sparse: true }, { key: { active: 1, category: 1 } }],
  orders: [{ key: { id: 1 }, unique: true }, { key: { number: 1 } }, { key: { shopifyId: 1 }, sparse: true }, { key: { createdAt: -1 } }, { key: { status: 1 } }],
  customers: [{ key: { id: 1 }, unique: true }, { key: { shopifyId: 1 }, sparse: true }, { key: { email: 1 } }],
  categories: [{ key: { slug: 1 }, unique: true }],
  pages: [{ key: { id: 1 }, unique: true }, { key: { handle: 1 } }],
  bookings: [{ key: { id: 1 }, unique: true }, { key: { date: 1 } }],
  banners: [{ key: { id: 1 }, unique: true }],
  events: [{ key: { id: 1 }, unique: true }],
  services: [{ key: { id: 1 }, sparse: true }],
  visits: [{ key: { at: -1 } }],
  payments: [{ key: { id: 1 }, unique: true }, { key: { razorpayOrderId: 1 } }, { key: { createdAt: -1 } }],
};

let cache = null;
let client = null;
let mongo = null;
let pgDriver = null;          /* the postgres.js module, set only in Cockroach mode */
let writeTimer = null;
let flushing = null;

/* key -> JSON of the last value written, per collection. Lets a flush send only
   the documents that actually changed instead of rewriting everything. */
const snapshots = new Map();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Mongo adds _id to anything it returns; the app's own key is `id`. */
const strip = ({ _id, ...rest }) => rest;

/* Primary key for a document. `categories` keys on slug and carries no id;
   everything else has one. The positional fallback is the last resort. */
export const keyOf = (doc, i) => doc.id || doc.slug || doc.handle || `idx_${i}`;

function snapshotOf(list) {
  const map = new Map();
  list.forEach((doc, i) => map.set(keyOf(doc, i), JSON.stringify(doc)));
  return map;
}

/* ------------------------------------------------------------------ connect */

/**
 * Connects to the configured store and loads every collection into memory.
 * Must be awaited before the server starts serving.
 */
export async function initDb() {
  if (pgUri()) return initCockroach();
  if (mongoUri()) return initMongo();
  load();
  return { mode: 'file', file: DB_FILE };
}

async function initCockroach() {
  /* Imported lazily so the file and Mongo modes never load the pg driver. */
  pgDriver = await import('./postgres.js');

  try {
    await pgDriver.ensureSchema(COLLECTIONS);
  } catch (e) {
    /* A wrong password, a paused cluster or a blocked port all surface here,
       and the driver's own message names none of them. */
    pgDriver = null;
    throw new Error(
      [
        'Could not connect to CockroachDB.',
        `  ${e.message}`,
        '  Check DATABASE_URL in server/.env: the password must be URL-encoded,',
        '  the host must end in :26257, and the cluster must not be paused.',
      ].join('\n')
    );
  }

  cache = structuredClone(EMPTY);
  for (const name of COLLECTIONS) {
    cache[name] = await pgDriver.loadCollection(name);
    snapshots.set(name, snapshotOf(cache[name]));
  }

  const settings = await pgDriver.loadSettings(SETTINGS_ID);
  cache.settings = settings ? { ...EMPTY.settings, ...settings } : { ...EMPTY.settings };
  snapshots.set('settings', new Map([[SETTINGS_ID, JSON.stringify(cache.settings)]]));

  const counts = Object.fromEntries(COLLECTIONS.map((c) => [c, cache[c].length]));
  return { mode: 'cockroach', db: pgDriver.databaseName(), counts };
}

async function initMongo() {
  const { MongoClient } = await import('mongodb');
  client = new MongoClient(mongoUri(), { retryWrites: true, serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
  } catch (e) {
    /* A bad URI or a missing IP allowlist entry is the usual cause, and the
       driver's own error says neither. */
    throw new Error(
      [
        'Could not connect to MongoDB.',
        `  ${e.message}`,
        '  Check MONGODB_URI in server/.env, that the password is URL-encoded,',
        '  and that your IP is allowed under Atlas > Network Access.',
      ].join('\n')
    );
  }
  mongo = client.db(mongoDbName());

  cache = structuredClone(EMPTY);
  for (const name of COLLECTIONS) {
    const docs = await mongo.collection(name).find({}).toArray();
    cache[name] = docs.map(strip);
    snapshots.set(name, snapshotOf(cache[name]));
  }

  const settings = await mongo.collection('settings').findOne({ _id: SETTINGS_ID });
  cache.settings = settings ? { ...EMPTY.settings, ...strip(settings) } : { ...EMPTY.settings };
  snapshots.set('settings', new Map([[SETTINGS_ID, JSON.stringify(cache.settings)]]));

  /* Cheap and idempotent -- safe to run on every boot. */
  await Promise.all(
    Object.entries(INDEXES).map(([name, specs]) =>
      mongo.collection(name).createIndexes(specs.map((s) => ({ ...s, background: true }))).catch(() => {})
    )
  );

  const counts = Object.fromEntries(COLLECTIONS.map((c) => [c, cache[c].length]));
  return { mode: 'mongo', db: mongoDbName(), counts };
}

export async function closeDb() {
  await flush();
  if (client) await client.close();
  if (pgDriver) await pgDriver.closePool();
  client = null;
  mongo = null;
  pgDriver = null;
}

/* --------------------------------------------------------------------- read */

export function load() {
  if (cache) return cache;
  ensureDir();
  try {
    cache = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

/* -------------------------------------------------------------------- write */

/** Diffs one collection against the snapshot taken at the last flush. */
function diff(name) {
  const prev = snapshots.get(name) || new Map();
  const next = snapshotOf(cache[name] || []);

  const changed = [];
  for (const [key, json] of next) {
    if (prev.get(key) !== json) changed.push([key, json]);
  }
  const removed = [...prev.keys()].filter((key) => !next.has(key));
  return { next, changed, removed };
}

const settingsChanged = () =>
  snapshots.get('settings')?.get(SETTINGS_ID) !== JSON.stringify(cache.settings);

const markSettingsWritten = () =>
  snapshots.set('settings', new Map([[SETTINGS_ID, JSON.stringify(cache.settings)]]));

/** Sends only what changed since the last flush. */
async function flushToPostgres() {
  for (const name of COLLECTIONS) {
    const { next, changed, removed } = diff(name);
    if (!changed.length && !removed.length) continue;
    await pgDriver.applyChanges(name, changed.map(([key, json]) => [key, JSON.parse(json)]), removed);
    snapshots.set(name, next);
  }

  if (settingsChanged()) {
    await pgDriver.saveSettings(SETTINGS_ID, cache.settings);
    markSettingsWritten();
  }
}

/** Sends only what changed since the last flush. */
async function flushToMongo() {
  for (const name of COLLECTIONS) {
    const { next, changed, removed } = diff(name);

    const ops = changed.map(([key, json]) => ({
      replaceOne: { filter: { id: key }, replacement: JSON.parse(json), upsert: true },
    }));
    if (removed.length) ops.push({ deleteMany: { filter: { id: { $in: removed } } } });

    if (ops.length) {
      await mongo.collection(name).bulkWrite(ops, { ordered: false });
      snapshots.set(name, next);
    }
  }

  if (settingsChanged()) {
    await mongo.collection('settings').replaceOne({ _id: SETTINGS_ID }, cache.settings, { upsert: true });
    markSettingsWritten();
  }
}

function flushToFile() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
}

async function flush() {
  if (!cache) return;
  /* Serialise flushes so two overlapping writes can't interleave. */
  flushing = (flushing || Promise.resolve())
    .then(() => {
      if (pgDriver) return flushToPostgres();
      if (mongo) return flushToMongo();
      return flushToFile();
    })
    .catch((e) => console.error('  ! persist failed:', e.message));
  return flushing;
}

/** Debounced write so high-frequency events (visits) don't thrash the store. */
export function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flush();
  }, mongo || pgDriver ? 400 : 120);
}

export function saveNow(data) {
  if (data) cache = data;
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  return flush();
}

export const db = new Proxy({}, {
  get: (_t, key) => load()[key],
  set: (_t, key, value) => { load()[key] = value; save(); return true; },
});

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/* Never lose the last few hundred milliseconds of writes on shutdown. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    try { await closeDb(); } catch { /* shutting down anyway */ }
    process.exit(0);
  });
}
