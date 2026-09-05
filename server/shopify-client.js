/* Thin Shopify client: public storefront JSON for the catalogue, Admin API for
   everything that needs a token. No dependencies -- Node's global fetch only. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'shopify.config.json');
const API_VERSION = '2024-10';

/* Config resolves in order: CLI flag > env var > gitignored config file. */
export function resolveConfig(flags = {}) {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { /* optional */ }

  const store = flags.store || process.env.SHOPIFY_STORE || file.store || '';
  const token = flags.token || process.env.SHOPIFY_TOKEN || file.token || '';

  return {
    /* Accepts "shop.myshopify.com", "https://shop.com/", or a bare domain. */
    store: store.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim(),
    token: token.trim(),
    apiVersion: flags.apiVersion || file.apiVersion || API_VERSION,
  };
}

export const configPath = CONFIG_FILE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Shopify's Admin bucket leaks at 2 calls/sec; a 429 hands back Retry-After. */
async function get(url, { token, tries = 4 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sukoon-importer',
        ...(token ? { 'X-Shopify-Access-Token': token } : {}),
      },
    });

    if (res.status === 429 && attempt < tries) {
      await sleep((Number(res.headers.get('retry-after')) || 2) * 1000);
      continue;
    }
    if (res.status >= 500 && attempt < tries) {
      await sleep(attempt * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} on ${url}\n${body.slice(0, 300)}`);
    }
    return { json: await res.json(), link: res.headers.get('link') || '' };
  }
}

/* ------------------------------------------------- public storefront (no token) */

/** Storefront JSON uses old-style ?page=N and stops when a page comes back short. */
async function publicPages(store, endpoint, key, { limit = 250, max = 100 } = {}) {
  const out = [];
  for (let page = 1; page <= max; page++) {
    const { json } = await get(`https://${store}/${endpoint}?limit=${limit}&page=${page}`);
    const batch = json[key] || [];
    out.push(...batch);
    if (batch.length < limit) break;
    await sleep(250);
  }
  return out;
}

export const fetchPublicProducts = (store) => publicPages(store, 'products.json', 'products');
export const fetchPublicCollections = (store) => publicPages(store, 'collections.json', 'collections');

/** Handles of the products inside one collection -- how we derive a category. */
export async function fetchCollectionProductHandles(store, handle) {
  const items = await publicPages(store, `collections/${handle}/products.json`, 'products');
  return items.map((p) => p.handle);
}

/* ------------------------------------------------------- admin API (needs token) */

/** Admin API paginates by cursor in the Link header: rel="next". */
async function adminPages({ store, token, apiVersion }, resource, params = {}) {
  const qs = new URLSearchParams({ limit: '250', ...params });
  let url = `https://${store}/admin/api/${apiVersion}/${resource}.json?${qs}`;
  const out = [];

  while (url) {
    const { json, link } = await get(url, { token });
    out.push(...(json[resource] || []));
    const next = /<([^>]+)>;\s*rel="next"/.exec(link);
    url = next ? next[1] : null;
    if (url) await sleep(550);
  }
  return out;
}

export const fetchOrders = (cfg, since) =>
  adminPages(cfg, 'orders', { status: 'any', ...(since ? { updated_at_min: since } : {}) });

export const fetchCustomers = (cfg, since) =>
  adminPages(cfg, 'customers', since ? { updated_at_min: since } : {});

export const fetchPages = (cfg) => adminPages(cfg, 'pages', { published_status: 'any' });

/** Admin product read -- adds inventory and per-variant SKUs the public feed hides. */
export const fetchAdminProducts = (cfg) => adminPages(cfg, 'products', { status: 'any' });

/** Cheap credential probe so the CLI can fail fast with a readable message. */
export async function verifyToken(cfg) {
  try {
    await get(`https://${cfg.store}/admin/api/${cfg.apiVersion}/shop.json`, { token: cfg.token });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
