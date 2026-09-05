/* Pulls a Shopify store into data/db.json.
 *
 *   node import-shopify.js --store my-shop.myshopify.com
 *   node import-shopify.js --all --token shpat_xxx
 *   node import-shopify.js --orders --since 2026-08-01 --dry-run
 *
 * Products and collections come from the public storefront JSON, so they need
 * no credentials at all. Orders, customers and pages need an Admin API token.
 * Every run upserts on the Shopify id, so re-running is safe and idempotent.
 */
import { load, saveNow, uid } from './db.js';
import {
  resolveConfig, configPath, verifyToken,
  fetchPublicProducts, fetchPublicCollections, fetchCollectionProductHandles,
  fetchAdminProducts, fetchOrders, fetchCustomers, fetchPages,
} from './shopify-client.js';
import { localiseImages } from './download-images.js';

/* ------------------------------------------------------------------ cli args */
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const has = (name) => argv.includes(`--${name}`);
const str = (name) => (typeof flag(name) === 'string' ? flag(name) : undefined);

const DRY = has('dry-run');
const SINCE = str('since') ? new Date(str('since')).toISOString() : undefined;

/* The public feed has no inventory counts, only in/out of stock. Products it
   reports as available get this placeholder so they stay buyable; they are
   tagged stockUnknown so the admin can tell a guess from a real count. */
const DEFAULT_STOCK = Number(str('default-stock')) > 0 ? Number(str('default-stock')) : 25;

/* No resource flags means "everything we have credentials for". */
const RESOURCES = ['products', 'collections', 'orders', 'customers', 'pages'];
const asked = RESOURCES.filter(has);
const WANT = new Set(asked.length && !has('all') ? asked : RESOURCES);

/* --------------------------------------------------------------- text helpers */
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  mdash: '—', ndash: '–', hellip: '…',
};

const decode = (s = '') =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (ENTITIES[code.toLowerCase()]) return ENTITIES[code.toLowerCase()];
    if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (/^#/.test(code)) return String.fromCodePoint(Number(code.slice(1)));
    return m;
  });

const stripHtml = (html = '') =>
  decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  ).replace(/\s+/g, ' ').trim();

/** Bullet points if the description has a list, else its first few sentences. */
function extractBenefits(html = '') {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length > 12 && t.length < 260);
  if (items.length) return items.slice(0, 6);

  return stripHtml(html)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.]+$/, ''))
    .filter((s) => s.length > 25 && s.length < 260)
    .slice(0, 3);
}

const slugify = (t = '') => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const money = (v) => Math.round(num(v));

/* Shopify serves originals; ?width=1000 matches the size the site already uses. */
const sizedImage = (src = '') => (src.includes('?') ? src : `${src}?width=1000`);

/* Tags are the only place a Shopify store can carry the astrology metadata this
   site models, so read them where they follow a "key:value" convention. */
const ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const CHAKRAS = ['root', 'sacral', 'solar plexus', 'heart', 'throat', 'third eye', 'crown'];
const ELEMENTS = ['earth', 'water', 'fire', 'air', 'aether', 'ether'];
const title = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());

function metaFromTags(tagString = '') {
  const tags = tagString.split(',').map((t) => t.trim()).filter(Boolean);
  const meta = { zodiac: [], stones: [] };

  for (const tag of tags) {
    const [rawKey, ...rest] = tag.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    const low = tag.toLowerCase();

    if (value && (key === 'stone' || key === 'crystal')) meta.stones.push(title(value));
    else if (value && key === 'chakra') meta.chakra = title(value);
    else if (value && key === 'element') meta.element = title(value);
    else if (value && key === 'zodiac') meta.zodiac.push(title(value));
    else if (ZODIAC.includes(low)) meta.zodiac.push(title(low));
    else if (CHAKRAS.includes(low)) meta.chakra = title(low);
    else if (ELEMENTS.includes(low)) meta.element = title(low);
  }
  if (meta.stones.length) meta.stone = meta.stones.join(', ');
  return { ...meta, tags };
}

/* ------------------------------------------------------------------ reporting */
const report = [];
const log = (...a) => console.log(...a);
const tally = (label, { created = 0, updated = 0, total = 0 }) => {
  report.push({ label, created, updated, total });
  log(`  ${label}: ${total} from Shopify -> ${created} new, ${updated} updated`);
};

/* ------------------------------------------------------------------- products */

/* Rebuilt from Shopify on every run. Everything else on a product is the site's
   own curation (stock, ratings, chakra...) and survives untouched. */
const SHOPIFY_OWNED = ['name', 'slug', 'price', 'mrp', 'description', 'images', 'published', 'vendor', 'productType', 'tags', 'variants'];

function mapProduct(sp, categoryFor) {
  const variants = sp.variants || [];
  const prices = variants.map((v) => num(v.price)).filter((p) => p > 0);
  const lowest = prices.length ? Math.min(...prices) : 0;
  const cheapest = variants.find((v) => num(v.price) === lowest);
  const price = money(lowest);
  const compareAt = money(cheapest && cheapest.compare_at_price);
  const html = sp.body_html || '';
  const meta = metaFromTags(Array.isArray(sp.tags) ? sp.tags.join(',') : sp.tags);

  return {
    shopifyId: sp.id,
    name: decode(sp.title || '').trim(),
    slug: sp.handle || slugify(sp.title),
    price,
    mrp: compareAt > price ? compareAt : price,
    description: stripHtml(html),
    benefits: extractBenefits(html),
    images: (sp.images || []).map((im) => sizedImage(im.src)),
    published: sp.published_at || null,
    vendor: sp.vendor || '',
    productType: sp.product_type || '',
    tags: meta.tags,
    category: categoryFor(sp.handle) || slugify(sp.product_type) || '',
    variants: variants.map((v) => ({
      shopifyId: v.id,
      title: v.title,
      sku: v.sku || '',
      price: money(v.price),
      mrp: money(v.compare_at_price) || money(v.price),
      available: v.available !== undefined ? v.available : (v.inventory_quantity || 0) > 0,
      inventory: v.inventory_quantity !== undefined ? v.inventory_quantity : null,
      options: [v.option1, v.option2, v.option3].filter(Boolean),
    })),
    /* Real counts come only from Admin reads. The public feed carries a plain
       in/out-of-stock boolean, so keep the two apart -- the site disables Add
       to Cart at stock 0, and a missing count must not read as sold out. */
    inventory: variants.some((v) => v.inventory_quantity !== undefined && v.inventory_quantity !== null)
      ? variants.reduce((t, v) => t + (v.inventory_quantity || 0), 0)
      : null,
    available: variants.length ? variants.some((v) => v.available !== false) : true,
    astro: { chakra: meta.chakra, element: meta.element, zodiac: meta.zodiac, stone: meta.stone, stones: meta.stones },
  };
}

async function importProducts(cfg, dbRef) {
  /* An Admin token gets real inventory numbers; without one the public feed
     still gives the full catalogue, just no stock levels. */
  const useAdmin = Boolean(cfg.token) && !has('public');
  const raw = useAdmin ? await fetchAdminProducts(cfg) : await fetchPublicProducts(cfg.store);
  log(`  fetched ${raw.length} products via ${useAdmin ? 'Admin API' : 'public storefront'}`);

  const categoryFor = dbRef.__categoryOf || (() => '');
  const existing = dbRef.products || [];
  const byShopify = new Map(existing.filter((p) => p.shopifyId).map((p) => [String(p.shopifyId), p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  let created = 0;
  let updated = 0;
  let nextSku = existing.length + 101;
  const seen = new Set();

  for (const sp of raw) {
    const mapped = mapProduct(sp, categoryFor);
    const prev = byShopify.get(String(sp.id)) || bySlug.get(mapped.slug);
    const { astro, inventory, available, ...fields } = mapped;

    if (prev) {
      /* Shopify-owned fields overwrite; site-only fields are left alone. */
      for (const key of SHOPIFY_OWNED) prev[key] = fields[key];
      prev.shopifyId = sp.id;
      prev.missingFromShopify = undefined;
      if (mapped.benefits.length) prev.benefits = mapped.benefits;
      if (mapped.category) prev.category = mapped.category;
      if (inventory !== null) {
        prev.stock = inventory;
        delete prev.stockUnknown;
      } else if (!available) {
        prev.stock = 0;               /* Shopify says sold out -- that is a real fact. */
      } else if (prev.stockUnknown || prev.stock === 0) {
        prev.stock = DEFAULT_STOCK;   /* Back in stock, but no count to copy. */
        prev.stockUnknown = true;
      }
      /* Tag-derived astrology only fills gaps -- hand-curated values win. */
      if (astro.chakra && !prev.chakra) prev.chakra = astro.chakra;
      if (astro.element && !prev.element) prev.element = astro.element;
      if (astro.stone && !prev.stone) prev.stone = astro.stone;
      if (astro.stones.length && !(prev.stones || []).length) prev.stones = astro.stones;
      if (astro.zodiac.length && !(prev.zodiac || []).length) prev.zodiac = astro.zodiac;
      seen.add(prev.id);
      updated++;
    } else {
      existing.push({
        id: uid('prd'),
        ...fields,
        sku: `SKN-${String(nextSku++).padStart(4, '0')}`,
        stone: astro.stone || '',
        stones: astro.stones,
        chakra: astro.chakra || '',
        element: astro.element || '',
        zodiac: astro.zodiac,
        stock: inventory !== null ? inventory : available ? DEFAULT_STOCK : 0,
        ...(inventory === null && available ? { stockUnknown: true } : {}),
        rating: 0,
        reviews: 0,
        featured: false,
        bestseller: false,
        active: sp.status ? sp.status === 'active' : true,
        sold: 0,
        order: existing.length,
        createdAt: sp.created_at || new Date().toISOString(),
      });
      created++;
    }
  }

  /* Products the site knows about that Shopify no longer lists: flagged, never
     deleted, so nothing disappears behind your back. */
  const live = new Set(raw.map((sp) => String(sp.id)));
  let stale = 0;
  for (const p of existing) {
    if (!p.shopifyId || seen.has(p.id)) continue;
    if (!live.has(String(p.shopifyId))) { p.missingFromShopify = true; stale++; }
  }
  if (stale) log(`  note: ${stale} product(s) no longer on Shopify -> flagged missingFromShopify, not deleted`);

  dbRef.products = existing;
  tally('products', { created, updated, total: raw.length });
}

/* ---------------------------------------------------------------- collections */

async function importCollections(cfg, dbRef) {
  const raw = await fetchPublicCollections(cfg.store);
  const existing = dbRef.categories || [];
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  let created = 0;
  let updated = 0;

  /* Build handle -> category lookup for the product pass. */
  const membership = new Map();
  for (const col of raw) {
    const slug = col.handle;
    const handles = await fetchCollectionProductHandles(cfg.store, slug).catch(() => []);
    for (const h of handles) if (!membership.has(h)) membership.set(h, slug);

    const prev = bySlug.get(slug);
    if (prev) {
      prev.name = decode(col.title);
      prev.shopifyId = col.id;
      prev.count = handles.length;
      /* Taglines are written for this site, not pulled from Shopify. */
      if (!prev.tagline) prev.tagline = stripHtml(col.body_html).slice(0, 120);
      updated++;
    } else {
      existing.push({
        slug,
        name: decode(col.title),
        tagline: stripHtml(col.body_html).slice(0, 120),
        shopifyId: col.id,
        count: handles.length,
      });
      created++;
    }
  }

  dbRef.categories = existing;
  dbRef.__categoryOf = (handle) => membership.get(handle) || '';
  tally('collections -> categories', { created, updated, total: raw.length });
}

/* ---------------------------------------------------------------------- orders */

/** Shopify tracks money and fulfilment separately; the site has one status line. */
function orderStatus(so) {
  if (so.cancelled_at) return 'cancelled';
  const shipment = (so.fulfillments || []).map((f) => f.shipment_status).filter(Boolean);
  if (shipment.includes('delivered')) return 'delivered';
  if (so.fulfillment_status === 'fulfilled') return shipment.length ? 'in_transit' : 'packed';
  if (so.fulfillment_status === 'partial') return 'packed';
  if (['paid', 'authorized', 'partially_paid'].includes(so.financial_status)) return 'confirmed';
  return 'placed';
}

function orderTimeline(so, status) {
  const line = [{ status: 'placed', at: so.created_at }];
  const push = (s, at) => { if (at && !line.some((e) => e.status === s)) line.push({ status: s, at }); };

  if (['paid', 'authorized', 'partially_paid', 'refunded', 'partially_refunded'].includes(so.financial_status)) {
    push('confirmed', so.processed_at || so.created_at);
  }
  for (const f of so.fulfillments || []) {
    push('packed', f.created_at);
    if (f.shipment_status && f.shipment_status !== 'delivered') push('in_transit', f.updated_at || f.created_at);
    if (f.shipment_status === 'delivered') push('delivered', f.updated_at || f.created_at);
  }
  if (so.cancelled_at) push('cancelled', so.cancelled_at);
  if (!line.some((e) => e.status === status)) line.push({ status, at: so.updated_at || so.created_at });
  return line;
}

function mapOrder(so, productByShopifyId) {
  const addr = so.shipping_address || so.billing_address || {};
  const cust = so.customer || {};
  const status = orderStatus(so);
  const fulfilment = (so.fulfillments || [])[0] || {};

  const items = (so.line_items || []).map((li) => {
    const p = productByShopifyId.get(String(li.product_id));
    return {
      productId: p ? p.id : null,
      shopifyProductId: li.product_id || null,
      name: decode(li.title || li.name || ''),
      slug: p ? p.slug : slugify(li.title || ''),
      price: money(li.price),
      qty: li.quantity || 1,
      image: p && p.images ? p.images[0] || '' : '',
      sku: li.sku || '',
      variant: li.variant_title || '',
    };
  });

  const subtotal = money(so.subtotal_price !== undefined && so.subtotal_price !== null
    ? so.subtotal_price
    : items.reduce((t, i) => t + i.price * i.qty, 0));
  const shipping = money((so.shipping_lines || []).reduce((t, l) => t + num(l.price), 0));
  const discount = money(so.total_discounts);
  const gateways = (so.payment_gateway_names || []).join(' ').toLowerCase();

  return {
    shopifyId: so.id,
    number: String(so.name || so.order_number || '').replace(/^#/, ''),
    createdAt: so.created_at,
    status,
    customer: {
      name: [addr.first_name || cust.first_name, addr.last_name || cust.last_name].filter(Boolean).join(' ').trim()
        || cust.email || 'Shopify customer',
      email: so.email || cust.email || '',
      phone: so.phone || addr.phone || cust.phone || '',
      address: [addr.address1, addr.address2].filter(Boolean).join(', '),
      city: addr.city || '',
      state: addr.province || '',
      pincode: addr.zip || '',
      shopifyCustomerId: cust.id || null,
    },
    items,
    subtotal,
    shipping,
    discount,
    total: money(so.total_price !== undefined && so.total_price !== null ? so.total_price : subtotal + shipping - discount),
    currency: so.currency || 'INR',
    payment: /cash|cod/.test(gateways) ? 'COD' : 'Prepaid',
    financialStatus: so.financial_status || '',
    courier: fulfilment.tracking_company || '',
    awb: fulfilment.tracking_number || '',
    source: so.source_name === 'web' ? 'Shopify' : (so.source_name || 'Shopify'),
    timeline: orderTimeline(so, status),
    notes: so.note || '',
  };
}

async function importOrders(cfg, dbRef) {
  const raw = await fetchOrders(cfg, SINCE);
  log(`  fetched ${raw.length} orders${SINCE ? ` updated since ${SINCE.slice(0, 10)}` : ''}`);

  const productByShopifyId = new Map(
    (dbRef.products || []).filter((p) => p.shopifyId).map((p) => [String(p.shopifyId), p])
  );
  const existing = dbRef.orders || [];
  const byShopify = new Map(existing.filter((o) => o.shopifyId).map((o) => [String(o.shopifyId), o]));
  let created = 0;
  let updated = 0;

  for (const so of raw) {
    const mapped = mapOrder(so, productByShopifyId);
    const prev = byShopify.get(String(so.id));
    if (prev) {
      Object.assign(prev, mapped, { id: prev.id });
      updated++;
    } else {
      const order = { id: uid('ord'), ...mapped };
      existing.unshift(order);
      byShopify.set(String(so.id), order);
      created++;
    }
  }

  /* The seeded demo orders are not Shopify's; --replace-demo clears them out. */
  if (has('replace-demo')) {
    const before = existing.length;
    dbRef.orders = existing.filter((o) => o.shopifyId);
    log(`  --replace-demo: dropped ${before - dbRef.orders.length} seeded demo order(s)`);
  } else {
    dbRef.orders = existing;
  }

  dbRef.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  tally('orders', { created, updated, total: raw.length });
}

/* ------------------------------------------------------------------- customers */

function mapCustomer(sc) {
  const addr = sc.default_address || {};
  return {
    shopifyId: sc.id,
    name: [sc.first_name, sc.last_name].filter(Boolean).join(' ').trim() || sc.email || 'Unnamed',
    email: sc.email || '',
    phone: sc.phone || addr.phone || '',
    address: [addr.address1, addr.address2].filter(Boolean).join(', '),
    city: addr.city || '',
    state: addr.province || '',
    pincode: addr.zip || '',
    ordersCount: sc.orders_count || 0,
    totalSpent: money(sc.total_spent),
    currency: sc.currency || 'INR',
    tags: (sc.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    acceptsMarketing: Boolean(sc.email_marketing_consent && sc.email_marketing_consent.state === 'subscribed'),
    note: sc.note || '',
    createdAt: sc.created_at,
    updatedAt: sc.updated_at,
  };
}

async function importCustomers(cfg, dbRef) {
  const raw = await fetchCustomers(cfg, SINCE);
  const existing = dbRef.customers || [];
  const byShopify = new Map(existing.filter((c) => c.shopifyId).map((c) => [String(c.shopifyId), c]));
  let created = 0;
  let updated = 0;

  for (const sc of raw) {
    const mapped = mapCustomer(sc);
    const prev = byShopify.get(String(sc.id));
    if (prev) {
      Object.assign(prev, mapped, { id: prev.id });
      updated++;
    } else {
      const customer = { id: uid('cus'), ...mapped };
      existing.push(customer);
      byShopify.set(String(sc.id), customer);
      created++;
    }
  }

  dbRef.customers = existing;
  tally('customers', { created, updated, total: raw.length });
}

/* ----------------------------------------------------------------------- pages */

async function importPages(cfg, dbRef) {
  const raw = await fetchPages(cfg);
  const existing = dbRef.pages || [];
  const byShopify = new Map(existing.filter((p) => p.shopifyId).map((p) => [String(p.shopifyId), p]));
  let created = 0;
  let updated = 0;

  for (const sp of raw) {
    const mapped = {
      shopifyId: sp.id,
      handle: sp.handle,
      title: decode(sp.title || ''),
      bodyHtml: sp.body_html || '',
      excerpt: stripHtml(sp.body_html).slice(0, 200),
      published: Boolean(sp.published_at),
      publishedAt: sp.published_at || null,
      updatedAt: sp.updated_at || null,
    };
    const prev = byShopify.get(String(sp.id));
    if (prev) {
      Object.assign(prev, mapped, { id: prev.id });
      updated++;
    } else {
      const page = { id: uid('pag'), ...mapped };
      existing.push(page);
      byShopify.set(String(sp.id), page);
      created++;
    }
  }

  dbRef.pages = existing;
  tally('pages', { created, updated, total: raw.length });
}

/* ------------------------------------------------------------------------ main */

async function main() {
  const cfg = resolveConfig({ store: str('store'), token: str('token') });

  if (!cfg.store) {
    console.error(
      'No Shopify store set.\n' +
      '  node import-shopify.js --store your-shop.myshopify.com\n' +
      '  or set SHOPIFY_STORE in the environment\n' +
      `  or create ${configPath}:\n` +
      '  { "store": "your-shop.myshopify.com", "token": "shpat_..." }'
    );
    process.exit(1);
  }

  const needsToken = ['orders', 'customers', 'pages'].filter((r) => WANT.has(r));
  if (needsToken.length && !cfg.token) {
    log(`\n! No Admin API token -- skipping ${needsToken.join(', ')}.`);
    log('  Products and collections are public, so those still import in full.');
    log('  To include the rest: Shopify admin > Settings > Apps and sales channels >');
    log('  Develop apps > Create an app > Configure Admin API scopes, tick');
    log('  read_products, read_orders, read_customers, read_content > Install >');
    log('  copy the Admin API access token, then re-run with --token shpat_...');
    needsToken.forEach((r) => WANT.delete(r));
  } else if (cfg.token) {
    const probe = await verifyToken(cfg);
    if (!probe.ok) {
      console.error(`\nAdmin API token rejected by ${cfg.store}:\n  ${probe.error}`);
      process.exit(1);
    }
  }

  log(`\nImporting from ${cfg.store} -> data/db.json${DRY ? '  (DRY RUN, nothing written)' : ''}`);
  log(`Resources: ${[...WANT].join(', ')}\n`);

  const dbRef = load();

  /* Collections run first so products can be filed under a category. */
  if (WANT.has('collections')) await importCollections(cfg, dbRef);
  if (WANT.has('products')) await importProducts(cfg, dbRef);
  if (WANT.has('orders')) await importOrders(cfg, dbRef);
  if (WANT.has('customers')) await importCustomers(cfg, dbRef);
  if (WANT.has('pages')) await importPages(cfg, dbRef);

  /* Shopify's CDN stops serving these the moment the plan lapses, so pull the
     files down while the store is still live. */
  if (has('download-images')) {
    log('\n  localising images...');
    const img = await localiseImages(dbRef, {
      dryRun: DRY,
      width: has('full') ? undefined : Number(str('width')) || 1200,
      format: has('full') ? undefined : str('format') || 'webp',
    });
    if (img.total && !DRY) {
      log(`  images: ${img.downloaded} downloaded, ${img.reused} already local, ${(img.bytes / 1048576).toFixed(1)} MB`);
      if (img.failed.length) log(`  ! ${img.failed.length} image(s) failed -- left pointing at Shopify`);
    }
  }

  delete dbRef.__categoryOf;
  dbRef.settings = { ...dbRef.settings, shopifyStore: cfg.store, lastShopifySync: new Date().toISOString() };

  if (DRY) {
    log('\nDry run -- db.json untouched. Drop --dry-run to write.');
  } else {
    saveNow(dbRef);
    log('\nWrote data/db.json');
  }

  const totals = report.reduce(
    (t, r) => ({ created: t.created + r.created, updated: t.updated + r.updated }),
    { created: 0, updated: 0 }
  );
  log(`Done: ${totals.created} created, ${totals.updated} updated. Restart the server to serve it.\n`);
}

main().catch((e) => {
  console.error(`\nImport failed: ${e.message}`);
  process.exit(1);
});
