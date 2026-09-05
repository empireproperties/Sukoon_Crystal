import './env.js';                 /* must be first: populates process.env */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { db, save, saveNow, uid, initDb } from './db.js';
import { configureCloudinary, uploadBuffer } from './cloudinary.js';
import {
  requireAuth,
  requireCustomer,
  optionalCustomer,
  publicCustomer,
  verifyToken,
  ensureAdmin,
  issueToken,
  verifyPassword,
  hashPassword,
  passwordProblem,
  publicAdmin,
  loginBlockedFor,
  recordFailure,
  clearFailures,
  tokenTtlMs,
} from './auth.js';

import { astroEnabled, searchCity, vedicChart, birthKey } from './astro.js';
import { buildReading, recommendProducts } from './reading.js';

import {
  isConfigured as razorpayReady,
  publicKey as rzpPublicKey,
  createOrder as createRzpOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
/* Razorpay webhooks are signed over the exact bytes sent, so keep the raw body
   around -- re-serialising the parsed JSON would not reproduce the signature. */
app.use(express.json({
  limit: '12mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

/* Admin uploads go to Cloudinary when it is configured -- local disk does not
   survive a redeploy, and the CDN serves f_auto/q_auto variants for free. The
   disk path stays as the offline-dev fallback, and /uploads keeps being served
   either way so URLs saved before Cloudinary was set up still resolve. */
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
app.use('/uploads', express.static(UPLOADS));

const cloud = configureCloudinary();

/* Real raster images only. SVG is deliberately excluded: it is a document
   format that can carry script, and serving one from our own origin would run
   that script as us. There was no filter here at all before. */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

const imagesOnly = (_req, file, cb) => {
  if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, WEBP or HEIC images can be uploaded.'));
};

const upload = multer({
  storage: cloud.configured
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: UPLOADS,
        filename: (_r, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`),
      }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imagesOnly,
});

/* Customer uploads are capped harder than the admin's -- a phone photo of a
   broken bracelet does not need eight megabytes, and this endpoint is reachable
   by anyone with an account. */
const customerUpload = multer({
  storage: cloud.configured ? multer.memoryStorage() : multer.diskStorage({
    destination: UPLOADS,
    filename: (_r, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imagesOnly,
});

/* ------------------------------------------------------------------ helpers */
const DAY = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const auth = requireAuth;
const find = (coll, id) => db[coll].find((x) => x.id === id);
const write = (coll, list) => { db[coll] = list; };

function upsert(coll, id, patch) {
  const list = db[coll];
  const i = list.findIndex((x) => x.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...patch, id };
  save();
  return list[i];
}

/* --------------------------------------------------------------------- auth */

/* One message for "no such email" and "wrong password" alike -- distinguishing
   them tells an attacker which addresses are worth attacking. */
const BAD_LOGIN = 'Those credentials do not match our records.';

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const key = `${req.ip}|${email}`;
  const blockedFor = loginBlockedFor(key);
  if (blockedFor) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(blockedFor / 60)} minute(s).` });
  }

  const admin = (db.admins || []).find((a) => a.email === email && a.active !== false);
  /* Hash even when the email is unknown, so a missing account is not detectably
     faster to reject than a wrong password. */
  const ok = await verifyPassword(password, admin?.passwordHash || 'scrypt$16384$8$1$AAAA$AAAA');

  if (!admin || !ok) {
    recordFailure(key);
    return res.status(401).json({ error: BAD_LOGIN });
  }

  clearFailures(key);
  upsert('admins', admin.id, { lastLoginAt: new Date().toISOString() });
  res.json({
    token: issueToken(admin),
    expiresAt: Date.now() + tokenTtlMs(),
    user: publicAdmin(admin),
  });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicAdmin(req.admin) }));

app.post('/api/auth/password', auth, async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');

  if (!(await verifyPassword(current, req.admin.passwordHash))) {
    return res.status(401).json({ error: 'Your current password is not correct.' });
  }
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  if (next === current) return res.status(400).json({ error: 'The new password must be different.' });

  /* Bumping epoch retires every token issued so far, this one included, so a
     password change really does sign out every other device. */
  const updated = upsert('admins', req.admin.id, {
    passwordHash: await hashPassword(next),
    epoch: (req.admin.epoch || 0) + 1,
    mustChangePassword: false,
    passwordChangedAt: new Date().toISOString(),
  });
  res.json({ token: issueToken(updated), expiresAt: Date.now() + tokenTtlMs(), user: publicAdmin(updated) });
});

/* ------------------------------------------------------- customer accounts */

/* Customer tokens carry aud:'customer', so one can never be replayed against an
   admin route even though both are signed with the same key. */
const custKey = (req, email) => `cust|${req.ip}|${email}`;

app.post('/api/account/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!name) return res.status(400).json({ error: 'Please tell us your name.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });

  /* Shopify-imported customers exist with no password -- let them claim the
     account rather than being told the address is taken. */
  const existing = (db.customers || []).find((c) => (c.email || '').toLowerCase() === email);
  if (existing?.passwordHash) return res.status(409).json({ error: 'An account already exists for that email. Try signing in.' });

  const passwordHash = await hashPassword(password);
  let customer;
  if (existing) {
    customer = upsert('customers', existing.id, { passwordHash, epoch: (existing.epoch || 0) + 1, name: existing.name || name, phone: phone || existing.phone || '', active: true });
  } else {
    customer = {
      id: uid('cus'), email, name, phone, passwordHash, epoch: 0, active: true,
      addresses: [], createdAt: new Date().toISOString(),
    };
    db.customers = [...(db.customers || []), customer];
    save();
  }
  res.status(201).json({ token: issueToken(customer, 'customer'), expiresAt: Date.now() + tokenTtlMs(), user: publicCustomer(customer) });
});

app.post('/api/account/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const key = custKey(req, email);
  const blockedFor = loginBlockedFor(key);
  if (blockedFor) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(blockedFor / 60)} minute(s).` });

  const customer = (db.customers || []).find((c) => (c.email || '').toLowerCase() === email && c.active !== false);
  const ok = await verifyPassword(password, customer?.passwordHash || 'scrypt$16384$8$1$AAAA$AAAA');
  if (!customer || !ok) {
    recordFailure(key);
    return res.status(401).json({ error: BAD_LOGIN });
  }

  clearFailures(key);
  upsert('customers', customer.id, { lastLoginAt: new Date().toISOString() });
  res.json({ token: issueToken(customer, 'customer'), expiresAt: Date.now() + tokenTtlMs(), user: publicCustomer(customer) });
});

app.get('/api/account/me', requireCustomer, (req, res) => res.json({ user: publicCustomer(req.customer) }));

app.put('/api/account/me', requireCustomer, (req, res) => {
  const { name, phone, addresses } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim().slice(0, 80);
  if (phone !== undefined) patch.phone = String(phone).trim().slice(0, 20);
  /* Email and password are changed through their own endpoints, never here. */
  if (Array.isArray(addresses)) patch.addresses = addresses.slice(0, 6);
  const updated = upsert('customers', req.customer.id, patch);
  res.json({ user: publicCustomer(updated) });
});

app.post('/api/account/password', requireCustomer, async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (!(await verifyPassword(current, req.customer.passwordHash))) {
    return res.status(401).json({ error: 'Your current password is not correct.' });
  }
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });

  const updated = upsert('customers', req.customer.id, {
    passwordHash: await hashPassword(next),
    epoch: (req.customer.epoch || 0) + 1,
    passwordChangedAt: new Date().toISOString(),
  });
  res.json({ token: issueToken(updated, 'customer'), expiresAt: Date.now() + tokenTtlMs(), user: publicCustomer(updated) });
});

/* ═══════════════════════════════════════════════════ birth charts (free) */
/*
 * A Vedic kundli, drawn once and kept on the customer's profile alongside
 * their name, phone, address and orders. Given free, because someone who has
 * seen their own chart on the site arrives at a consultation already trusting
 * it — and because it tells us which stones to put in front of them.
 *
 * Sign-in is required. Not to gate the gift: the chart has to live somewhere,
 * and the calculation budget is small enough that an open endpoint would be
 * drained by the first crawler that found it.
 */

/** Public: lets the storefront decide whether to show the offer at all. */
app.get('/api/astro/status', (req, res) => res.json({ enabled: astroEnabled() }));

/** Birth-place lookup. Behind a login for the same budget reason. */
app.get('/api/astro/cities', requireCustomer, async (req, res) => {
  try {
    res.json({ results: await searchCity(req.query.q) });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

/* Somebody re-typing their birth time over and over would spend the day's
   calculations on their own curiosity. Distinct charts, not requests: fixing a
   typo and asking again for the same minute costs nothing. */
const CHART_LIMIT_PER_DAY = 4;

const chartAllowance = (customer) => {
  const since = Date.now() - 86400000;
  const recent = (customer.chartRuns || []).filter((t) => t > since);
  return { recent, left: CHART_LIMIT_PER_DAY - recent.length };
};

/** Validates what the browser sent and turns it into the API's shape. */
function readBirth(body) {
  const date = String(body?.date || '');
  const time = String(body?.time || '');
  const timeKnown = body?.timeKnown !== false;
  const place = body?.place || {};

  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dm) return { error: 'Please give your date of birth.' };

  const [year, month, day] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const thisYear = new Date().getFullYear();
  if (year < 1900 || year > thisYear) return { error: 'Please check the year of birth.' };
  if (month < 1 || month > 12 || day < 1 || day > 31) return { error: 'Please check the date of birth.' };
  if (new Date(`${date}T00:00:00Z`) > new Date()) return { error: 'That date is in the future.' };

  /* An unknown birth time is normal and honest — plenty of people genuinely do
     not know theirs. Noon keeps the moon's sign right in almost every case;
     the ascendant is the part that cannot be trusted, and the reading says so
     rather than quietly presenting a guess as fact. */
  let hour = 12;
  let minute = 0;
  if (timeKnown) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!tm) return { error: 'Please give your time of birth, or tick that you do not know it.' };
    hour = Number(tm[1]);
    minute = Number(tm[2]);
    if (hour > 23 || minute > 59) return { error: 'Please check the time of birth.' };
  }

  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'Please pick your place of birth from the list.' };
  }

  return {
    birth: {
      year, month, day, hour, minute, timeKnown,
      city: String(place.name || '').slice(0, 80),
      state: String(place.state || '').slice(0, 80),
      country: String(place.country || '').slice(0, 60),
      lat, lng,
      tz: String(place.tz || 'Asia/Kolkata').slice(0, 60),
    },
  };
}

/** Assembles what the page renders from a stored chart row. */
const dressChart = (row, birth) => {
  const reading = buildReading(row.data);
  return {
    birth,
    svg: row.svg,
    computedAt: row.computedAt,
    reading,
    recommended: recommendProducts(reading, db.products || []),
  };
};

/** The chart already on file, with no API call and no cost. */
app.get('/api/account/birth-chart', requireCustomer, (req, res) => {
  const birth = req.customer.birth;
  const row = birth && (db.charts || []).find((c) => c.id === req.customer.chartKey);
  if (!row) return res.json({ chart: null, birth: birth || null, ...chartAllowance(req.customer) });
  res.json({ chart: dressChart(row, birth), ...chartAllowance(req.customer) });
});

/** Saves the birth details and draws the chart. */
app.post('/api/account/birth-chart', requireCustomer, async (req, res) => {
  if (!astroEnabled()) return res.status(503).json({ error: 'Birth charts are not switched on yet.' });

  const { birth, error } = readBirth(req.body);
  if (error) return res.status(400).json({ error });

  const key = birthKey(birth);
  const known = (db.charts || []).find((c) => c.id === key && c.svg);
  const { recent, left } = chartAllowance(req.customer);

  /* The limit only bites on a chart nobody has drawn before. */
  if (!known && left <= 0) {
    return res.status(429).json({
      error: 'You have drawn a few charts today. Please try again tomorrow, or book a call and Swati will go through it with you.',
    });
  }

  try {
    const row = await vedicChart(birth);
    upsert('customers', req.customer.id, {
      birth,
      chartKey: key,
      chartRuns: known ? recent : [...recent, Date.now()],
    });
    res.json({ chart: dressChart(row, birth), cache: row.cache });
  } catch (e) {
    console.error('[astro] chart failed', e.message);
    res.status(e.status || 502).json({ error: e.message || 'We could not draw the chart just now.' });
  }
});

/** Swati's view of a customer's chart, so she can read it before a call. */
app.get('/api/customers/:id/birth-chart', auth, (req, res) => {
  const customer = (db.customers || []).find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'No such customer.' });
  const row = customer.chartKey && (db.charts || []).find((c) => c.id === customer.chartKey);
  if (!row) return res.json({ chart: null, birth: customer.birth || null });
  res.json({ chart: dressChart(row, customer.birth) });
});

/** A customer's own orders. Scoped by id, never by anything the client sends. */
app.get('/api/account/orders', requireCustomer, (req, res) => {
  const mine = (db.orders || [])
    .filter((o) => o.customerId === req.customer.id
      || (o.customer?.email || '').toLowerCase() === (req.customer.email || '').toLowerCase())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(mine);
});

/* ----------------------------------------------------------------- settings */
/* `settings` is served to every visitor, so anything secret that ends up in it
   must never leave this function. auth.js falls back to storing a generated
   token-signing key here when AUTH_SECRET is unset; publishing it would let
   anyone mint their own admin token. */
const SETTINGS_SECRETS = ['authSecret'];
const publicSettings = (s) => {
  const out = { ...s };
  for (const k of SETTINGS_SECRETS) delete out[k];
  return out;
};

app.get('/api/settings', (_req, res) => res.json(publicSettings(db.settings)));

app.put('/api/settings', auth, (req, res) => {
  /* Equally, a client must not be able to overwrite the signing key. */
  const patch = { ...req.body };
  for (const k of SETTINGS_SECRETS) delete patch[k];
  db.settings = { ...db.settings, ...patch };
  res.json(publicSettings(db.settings));
});

/* ----------------------------------------------------------------- products */
app.get('/api/products', (req, res) => {
  const { category, q, zodiac, sort, featured, min, max, all } = req.query;
  let list = db.products.filter((p) => (all === '1' ? true : p.active !== false));
  if (category && category !== 'all') list = list.filter((p) => p.category === category);
  if (zodiac && zodiac !== 'all') list = list.filter((p) => (p.zodiac || []).includes(zodiac));
  if (featured === '1') list = list.filter((p) => p.featured);
  if (min) list = list.filter((p) => p.price >= +min);
  if (max) list = list.filter((p) => p.price <= +max);
  if (q) {
    const t = String(q).toLowerCase();
    list = list.filter((p) =>
      [p.name, p.stone, p.description, p.chakra, p.element, ...(p.benefits || [])]
        .join(' ').toLowerCase().includes(t));
  }
  const sorters = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    popular: (a, b) => b.sold - a.sold,
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  if (sorters[sort]) list = [...list].sort(sorters[sort]);
  res.json(list);
});

app.get('/api/products/:idOrSlug', (req, res) => {
  const key = req.params.idOrSlug;
  const p = db.products.find((x) => x.id === key || x.slug === key);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const related = db.products
    .filter((x) => x.id !== p.id && x.active !== false && (x.category === p.category || x.chakra === p.chakra))
    .slice(0, 4);
  res.json({ ...p, related });
});

app.post('/api/products', auth, (req, res) => {
  const body = req.body || {};
  const slug = (body.slug || body.name || 'crystal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const product = {
    id: uid('prd'),
    slug: db.products.some((p) => p.slug === slug) ? `${slug}-${Math.floor(Math.random() * 900 + 100)}` : slug,
    name: 'Untitled crystal',
    category: 'wellness-bracelets',
    price: 999, mrp: 1299, stock: 10, stone: '', description: '',
    benefits: [], stones: [], chakra: 'Heart', element: 'Earth', zodiac: [],
    images: [], rating: 4.8, reviews: 0, sold: 0,
    featured: false, bestseller: false, active: true,
    sku: `SKN-${String(db.products.length + 101).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    ...body,
  };
  db.products = [product, ...db.products];
  res.status(201).json(product);
});

app.put('/api/products/:id', auth, (req, res) => {
  const p = upsert('products', req.params.id, req.body);
  p ? res.json(p) : res.status(404).json({ error: 'Not found' });
});

app.delete('/api/products/:id', auth, (req, res) => {
  write('products', db.products.filter((p) => p.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  if (!cloud.configured) return res.json({ url: `/uploads/${req.file.filename}` });

  try {
    const { url } = await uploadBuffer(req.file.buffer, { filename: req.file.originalname });
    res.json({ url });
  } catch (e) {
    res.status(502).json({ error: `Cloudinary upload failed: ${e.message}` });
  }
});

/* Photos a customer attaches to a return. Requires a signed-in account, is
   capped at 5MB, images only, and lands in its own Cloudinary folder so return
   evidence never mixes with catalogue artwork. */
app.post('/api/account/uploads', requireCustomer, customerUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image received.' });
  if (!cloud.configured) return res.json({ url: `/uploads/${req.file.filename}` });

  try {
    const { url } = await uploadBuffer(req.file.buffer, {
      filename: req.file.originalname,
      folder: `${process.env.CLOUDINARY_FOLDER || 'sukoon'}/returns`,
    });
    res.json({ url });
  } catch (e) {
    res.status(502).json({ error: `Upload failed: ${e.message}` });
  }
});

/* multer rejects a bad type or an oversized file by throwing, which Express
   would otherwise render as an HTML stack trace the browser cannot parse. */
app.use((err, _req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That image is too large. Please keep it under 5MB.' });
  if (/can be uploaded/.test(err.message || '')) return res.status(415).json({ error: err.message });
  next(err);
});

/* ------------------------------------------------------------------- orders */
const FLOW = ['placed', 'confirmed', 'packed', 'in_transit', 'delivered'];

app.get('/api/orders', auth, (req, res) => {
  const { status, q } = req.query;
  let list = db.orders;
  if (status && status !== 'all') list = list.filter((o) => o.status === status);
  if (q) {
    const t = String(q).toLowerCase();
    list = list.filter((o) =>
      [o.number, o.customer.name, o.customer.phone, o.customer.city, o.awb].join(' ').toLowerCase().includes(t));
  }
  res.json(list);
});

app.get('/api/orders/track/:number', (req, res) => {
  const o = db.orders.find((x) => x.number.toLowerCase() === String(req.params.number).toLowerCase());
  if (!o) return res.status(404).json({ error: 'No order found with that number.' });
  res.json({
    number: o.number, status: o.status, createdAt: o.createdAt, timeline: o.timeline,
    courier: o.courier, awb: o.awb, items: o.items, total: o.total,
    customer: { name: o.customer.name, city: o.customer.city, state: o.customer.state },
  });
});

/* Prices a cart from the catalogue. The browser sends product ids and
   quantities only -- every rupee is decided here. */
/* ------------------------------------------------------------------ coupons */

const codeOf = (c) => String(c || '').trim().toUpperCase();

/**
 * Checks a code against the coupon rules and works out what it is worth.
 *
 * Everything here is server-side on purpose. The discount used to be sent by
 * the browser and merely capped at the subtotal, so posting a large number
 * brought the total to zero and the order went through for free.
 */
export function evaluateCoupon(rawCode, subtotal) {
  const code = codeOf(rawCode);
  if (!code) return { ok: false, discount: 0, error: null };

  const c = (db.coupons || []).find((x) => codeOf(x.code) === code);
  if (!c) return { ok: false, discount: 0, error: 'That code is not recognised.' };
  if (c.active === false) return { ok: false, discount: 0, error: 'That code is no longer active.' };

  const today = dayKey(Date.now());
  if (c.startDate && c.startDate > today) return { ok: false, discount: 0, error: 'That code is not active yet.' };
  if (c.endDate && c.endDate < today) return { ok: false, discount: 0, error: 'That code has expired.' };

  if (c.usageLimit > 0 && (c.used || 0) >= c.usageLimit) {
    return { ok: false, discount: 0, error: 'That code has been fully redeemed.' };
  }
  if (c.minOrder > 0 && subtotal < c.minOrder) {
    return { ok: false, discount: 0, error: `Spend ₹${c.minOrder} or more to use this code.` };
  }

  let discount = c.type === 'flat'
    ? Number(c.value) || 0
    : Math.round((subtotal * (Number(c.value) || 0)) / 100);

  /* A percentage coupon can be capped so "30% off" cannot cost a fortune on a
     large basket. */
  if (c.maxDiscount > 0) discount = Math.min(discount, c.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal));

  return {
    ok: true,
    discount,
    error: null,
    coupon: { id: c.id, code: codeOf(c.code), type: c.type, value: c.value, label: c.label || '' },
  };
}

/** Counts a redemption. Called only once an order actually exists. */
function redeemCoupon(couponId) {
  if (!couponId) return;
  const c = (db.coupons || []).find((x) => x.id === couponId);
  if (c) upsert('coupons', c.id, { used: (c.used || 0) + 1, lastUsedAt: new Date().toISOString() });
}

/**
 * Prices a cart from the catalogue. `couponCode` is a string; the discount is
 * derived here and never taken from the request.
 */
function priceCart(items = [], couponCode = '') {
  const priced = items
    .map((it) => {
      const p = db.products.find((x) => x.id === it.productId || x.slug === it.slug);
      if (!p) return null;
      return {
        productId: p.id, name: p.name, slug: p.slug, price: p.price,
        qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
        image: p.images?.[0] || '',
      };
    })
    .filter(Boolean);

  const subtotal = priced.reduce((t, it) => t + it.price * it.qty, 0);
  const shipping = subtotal >= 999 ? 0 : 60;
  const applied = evaluateCoupon(couponCode, subtotal);
  const discount = applied.ok ? applied.discount : 0;

  return {
    priced, subtotal, shipping, discount,
    coupon: applied.coupon || null,
    couponError: applied.error,
    total: subtotal + shipping - discount,
  };
}

/** Lets the cart show what a code is worth before anything is ordered. */
app.post('/api/coupons/check', (req, res) => {
  const { items = [], code = '' } = req.body || {};
  const priced = priceCart(items, code);
  if (!priced.priced.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (priced.couponError) return res.status(400).json({ error: priced.couponError });
  res.json({
    ok: true,
    code: priced.coupon?.code || '',
    label: priced.coupon?.label || '',
    discount: priced.discount,
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
  });
});

/* --------------------------------------------------------- address lookup */
/* Public: these only turn a PIN or a coordinate into a city name, and both
   upstreams are free and keyless. Failures return 200 with ok:false so the
   checkout can shrug and let the shopper type it. */
app.get('/api/geo/pincode/:pin', async (req, res) => {
  const { lookupPincode } = await import('./geo.js');
  res.json(await lookupPincode(req.params.pin));
});

app.get('/api/geo/reverse', async (req, res) => {
  const { reverseGeocode } = await import('./geo.js');
  res.json(await reverseGeocode(req.query.lat, req.query.lon));
});

/* ------------------------------------------------------- coupons (admin) */
app.get('/api/coupons', auth, (_req, res) =>
  res.json([...(db.coupons || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))));

app.post('/api/coupons', auth, (req, res) => {
  const code = codeOf(req.body?.code);
  if (!code) return res.status(400).json({ error: 'A code is required.' });
  if ((db.coupons || []).some((c) => codeOf(c.code) === code)) {
    return res.status(409).json({ error: 'That code already exists.' });
  }
  const coupon = {
    id: uid('cpn'),
    code,
    label: '',
    type: 'percent',        /* 'percent' | 'flat' */
    value: 10,
    maxDiscount: 0,         /* 0 = uncapped */
    minOrder: 0,
    usageLimit: 0,          /* 0 = unlimited */
    used: 0,
    startDate: '',
    endDate: '',
    active: true,
    createdAt: new Date().toISOString(),
    ...req.body,
    /* `used` is a ledger, never something a form can set. */
    ...(req.body?.used !== undefined ? { used: 0 } : {}),
  };
  coupon.code = codeOf(coupon.code);
  db.coupons = [...(db.coupons || []), coupon];
  save();
  res.status(201).json(coupon);
});

app.put('/api/coupons/:id', auth, (req, res) => {
  const patch = { ...req.body };
  if (patch.code) patch.code = codeOf(patch.code);
  /* Redemptions are a record of what happened; editing a coupon must not
     silently reset how many times it has been used. */
  delete patch.used;
  const updated = upsert('coupons', req.params.id, patch);
  updated ? res.json(updated) : res.status(404).json({ error: 'Not found' });
});

app.delete('/api/coupons/:id', auth, (req, res) => {
  write('coupons', (db.coupons || []).filter((c) => c.id !== req.params.id));
  save();
  res.json({ ok: true });
});

/* Numbering off `orders.length` collides as soon as an order is deleted, and a
   duplicate number breaks order tracking. Derive it from the highest in use. */
function nextOrderNumber() {
  const highest = db.orders.reduce((max, o) => {
    const n = Number(String(o.number || '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 1000);
  return `SKN${highest + 1}`;
}

function buildOrder({ priced, subtotal, shipping, discount, total, coupon }, customer, payment, extra = {}) {
  extra = { ...extra, coupon: coupon || null };
  const at = new Date().toISOString();
  return {
    id: uid('ord'),
    number: nextOrderNumber(),
    createdAt: at,
    status: 'placed',
    customer, items: priced, subtotal, shipping, discount, total,
    coupon: extra.coupon || null,
    payment,
    courier: 'Delhivery',
    awb: `AWB${Math.floor(Math.random() * 900000000 + 100000000)}`,
    source: 'Website',
    timeline: [{ status: 'placed', at }],
    notes: '',
    ...extra,
  };
}

function commitStock(priced) {
  for (const it of priced) {
    const p = db.products.find((x) => x.id === it.productId);
    if (p) { p.stock = Math.max(0, (p.stock || 0) - it.qty); p.sold = (p.sold || 0) + it.qty; }
  }
}

app.post('/api/orders', optionalCustomer, (req, res) => {
  const { items = [], customer = {}, payment = 'Prepaid', couponCode = '' } = req.body || {};
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });

  /* With Razorpay live, an online order may only be created by the verified
     payment route -- otherwise this endpoint would mint paid orders for free. */
  if (payment !== 'COD' && razorpayReady()) {
    return res.status(400).json({ error: 'Online payments must go through the payment flow.' });
  }

  const totals = priceCart(items, couponCode);
  if (!totals.priced.length) return res.status(400).json({ error: 'None of those products are available.' });
  /* A code that was valid when the cart page loaded may have expired since. */
  if (couponCode && totals.couponError) return res.status(400).json({ error: totals.couponError });

  const order = buildOrder(totals, customer, payment === 'COD' ? 'COD' : 'Prepaid');
  /* Signed in? Bind the order to the account so it shows under My Orders and a
     return can be raised against it. Taken from the token, never the body. */
  if (req.customer) order.customerId = req.customer.id;
  db.orders = [order, ...db.orders];
  commitStock(totals.priced);
  redeemCoupon(totals.coupon?.id);
  save();
  res.status(201).json(order);
});

app.put('/api/orders/:id', auth, (req, res) => {
  const o = find('orders', req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const { status, notes, courier, awb } = req.body || {};
  if (status && status !== o.status) {
    o.status = status;
    o.timeline = [...(o.timeline || []), { status, at: new Date().toISOString() }];
    /* The return window runs from delivery, so that moment has to be recorded
       rather than inferred from whenever the row was last touched. */
    if (status === 'delivered' && !o.deliveredAt) o.deliveredAt = new Date().toISOString();
  }
  o.updatedAt = new Date().toISOString();
  if (notes !== undefined) o.notes = notes;
  if (courier) o.courier = courier;
  if (awb) o.awb = awb;
  save();
  res.json(o);
});

/* An invoice is issued once and then frozen. Both an admin and the customer who
   placed the order can fetch it; nobody else can. */
app.get('/api/orders/:id/invoice', optionalCustomer, async (req, res) => {
  const order = (db.orders || []).find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });

  const isAdmin = Boolean(verifyToken((req.headers.authorization || '').replace('Bearer ', ''), 'admin'));
  const isOwner = req.customer && (order.customerId === req.customer.id
    || (order.customer?.email || '').toLowerCase() === (req.customer.email || '').toLowerCase());
  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not yours to view.' });

  /* Nothing is invoiced before it is paid for or on its way. */
  if (order.status === 'placed' && order.payment === 'COD') {
    return res.status(409).json({ error: 'An invoice is issued once the order is confirmed.' });
  }

  const { ensureInvoice } = await import('./invoice.js');
  res.json(ensureInvoice(order));
});

app.delete('/api/orders/:id', auth, (req, res) => {
  write('orders', db.orders.filter((o) => o.id !== req.params.id));
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- payments */

/* Tells the checkout whether to open Razorpay or fall back to the demo flow. */
app.get('/api/payments/config', (_req, res) =>
  res.json({ razorpay: razorpayReady(), keyId: razorpayReady() ? rzpPublicKey() : null }));

/* Step 1: price the cart here, open a Razorpay order for exactly that amount,
   and park the priced snapshot. No site order exists until payment verifies. */
app.post('/api/payments/razorpay/order', async (req, res) => {
  if (!razorpayReady()) return res.status(503).json({ error: 'Online payment is not configured.' });

  const { items = [], customer = {}, couponCode = '' } = req.body || {};
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });

  const totals = priceCart(items, couponCode);
  if (!totals.priced.length) return res.status(400).json({ error: 'None of those products are available.' });
  if (totals.total <= 0) return res.status(400).json({ error: 'Order total must be greater than zero.' });

  const short = uid('pay');
  try {
    const rzpOrder = await createRzpOrder({
      amount: totals.total,
      receipt: short,
      notes: { customer: customer.name || '', phone: customer.phone || '' },
    });

    db.payments = [{
      id: short,
      razorpayOrderId: rzpOrder.id,
      status: 'created',
      amount: totals.total,
      totals,
      customer,
      createdAt: new Date().toISOString(),
    }, ...db.payments];
    save();

    res.json({
      keyId: rzpPublicKey(),
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      /* Echoed back so the UI can show what will be charged. */
      totals: { subtotal: totals.subtotal, shipping: totals.shipping, discount: totals.discount, total: totals.total },
    });
  } catch (e) {
    console.error('  ! razorpay order failed:', e.message);
    res.status(502).json({ error: 'Could not reach the payment gateway. Please try again.' });
  }
});

/** Turns a verified payment intent into a real order. Safe to call twice. */
function fulfilPayment(intent, paymentId) {
  const existing = db.orders.find((o) => o.razorpayPaymentId === paymentId);
  if (existing) return existing;

  const order = buildOrder(intent.totals, intent.customer, 'Prepaid', {
    razorpayOrderId: intent.razorpayOrderId,
    razorpayPaymentId: paymentId,
    paidAt: new Date().toISOString(),
  });
  db.orders = [order, ...db.orders];
  commitStock(intent.totals.priced);
  /* Prepaid orders were not counting the redemption — only the COD path did —
     so a coupon's usage limit could be exceeded by paying online. */
  redeemCoupon(intent.totals.coupon?.id);

  intent.status = 'paid';
  intent.orderId = order.id;
  save();
  return order;
}

/* Step 2: the browser reports success. Trust the signature, not the browser. */
app.post('/api/payments/razorpay/verify', (req, res) => {
  if (!razorpayReady()) return res.status(503).json({ error: 'Online payment is not configured.' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    console.warn('  ! rejected payment with bad signature:', razorpay_order_id);
    return res.status(400).json({ error: 'Payment could not be verified.' });
  }

  const intent = db.payments.find((p) => p.razorpayOrderId === razorpay_order_id);
  if (!intent) return res.status(404).json({ error: 'That payment session has expired.' });

  res.status(201).json(fulfilPayment(intent, razorpay_payment_id));
});

/* Backstop: if the customer closes the tab after paying, the webhook still
   creates the order. Signed over the raw body with the webhook secret. */
app.post('/api/payments/razorpay/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity;
  if (event === 'payment.captured' && entity) {
    const intent = db.payments.find((p) => p.razorpayOrderId === entity.order_id);
    if (intent) fulfilPayment(intent, entity.id);
  }
  /* Always 200 on a valid signature, or Razorpay keeps retrying. */
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ banners */
app.get('/api/banners', (req, res) => {
  if (req.query.all === '1') return res.json(db.banners);
  const today = dayKey(Date.now());
  res.json(db.banners.filter((b) =>
    b.active && (!b.startDate || b.startDate <= today) && (!b.endDate || b.endDate >= today)));
});

app.post('/api/banners', auth, (req, res) => {
  const banner = {
    id: uid('bnr'), title: 'New banner', subtitle: '', message: '', code: '', cta: 'Shop now',
    link: '/shop', palette: 'gold', placement: 'top', active: false,
    image: '', startDate: dayKey(Date.now()), endDate: dayKey(Date.now() + 14 * DAY),
    createdAt: new Date().toISOString(), ...req.body,
  };
  db.banners = [banner, ...db.banners];
  res.status(201).json(banner);
});
app.put('/api/banners/:id', auth, (req, res) => {
  const b = upsert('banners', req.params.id, req.body);
  b ? res.json(b) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/banners/:id', auth, (req, res) => {
  write('banners', db.banners.filter((b) => b.id !== req.params.id));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- events */
app.get('/api/events', (req, res) => {
  const list = req.query.all === '1' ? db.events : db.events.filter((e) => e.published !== false);
  res.json([...list].sort((a, b) => a.date.localeCompare(b.date)));
});
app.post('/api/events', auth, (req, res) => {
  const ev = {
    id: uid('evt'), title: 'New event', date: dayKey(Date.now()), time: '19:00',
    type: 'celestial', description: '', location: 'Online / Instagram Live',
    published: true, createdAt: new Date().toISOString(), ...req.body,
  };
  db.events = [ev, ...db.events];
  res.status(201).json(ev);
});
app.put('/api/events/:id', auth, (req, res) => {
  const e = upsert('events', req.params.id, req.body);
  e ? res.json(e) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/events/:id', auth, (req, res) => {
  write('events', db.events.filter((e) => e.id !== req.params.id));
  res.json({ ok: true });
});

/* ------------------------------------------------- categories / imported data */
app.get('/api/categories', (_req, res) => res.json(db.categories || []));

/* Everyone who has ever bought, whether or not they created an account. Guest
   checkouts only exist inside their orders, so they are folded in by email --
   otherwise the admin's customer list would omit most real buyers. */
app.get('/api/customers/summary', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const byKey = new Map();

  const keyFor = (email, phone, name) =>
    (email || '').toLowerCase() || (phone || '') || `name:${(name || '').toLowerCase()}`;

  for (const c of db.customers || []) {
    const key = keyFor(c.email, c.phone, c.name);
    if (!key) continue;
    byKey.set(key, {
      id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '',
      hasAccount: Boolean(c.passwordHash), createdAt: c.createdAt,
      lastLoginAt: c.lastLoginAt || null, shopifyId: c.shopifyId || null,
      orders: 0, spent: 0, lastOrderAt: null, city: c.city || '',
      /* Enough for Swati to see at a glance who has a chart on file, and to
         open it before a call. The chart itself is a separate request. */
      hasChart: Boolean(c.chartKey),
      birth: c.birth ? {
        date: `${c.birth.year}-${String(c.birth.month).padStart(2, '0')}-${String(c.birth.day).padStart(2, '0')}`,
        time: c.birth.timeKnown === false ? '' : `${String(c.birth.hour).padStart(2, '0')}:${String(c.birth.minute).padStart(2, '0')}`,
        place: [c.birth.city, c.birth.state].filter(Boolean).join(', '),
      } : null,
    });
  }

  for (const o of db.orders || []) {
    const cu = o.customer || {};
    const key = keyFor(cu.email, cu.phone, cu.name);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: o.customerId || `guest:${key}`, name: cu.name || '', email: cu.email || '', phone: cu.phone || '',
        hasAccount: false, createdAt: o.createdAt, lastLoginAt: null, shopifyId: null,
        orders: 0, spent: 0, lastOrderAt: null, city: cu.city || '',
      });
    }
    const rec = byKey.get(key);
    rec.orders += 1;
    if (o.status !== 'cancelled') rec.spent += o.total || 0;
    if (!rec.lastOrderAt || o.createdAt > rec.lastOrderAt) rec.lastOrderAt = o.createdAt;
    if (!rec.city && cu.city) rec.city = cu.city;
    if (!rec.name && cu.name) rec.name = cu.name;
  }

  let list = [...byKey.values()];
  if (q) {
    list = list.filter((c) =>
      [c.name, c.email, c.phone, c.city].filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  list.sort((a, b) => (b.spent - a.spent) || String(b.lastOrderAt).localeCompare(String(a.lastOrderAt)));
  res.json(list);
});

app.get('/api/customers', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  /* Password hashes must never leave the server, even to a signed-in admin. */
  let list = (db.customers || []).map(({ passwordHash, epoch, ...rest }) => rest);
  if (q) {
    list = list.filter((c) =>
      [c.name, c.email, c.phone, c.city].filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  res.json(list);
});

app.get('/api/pages', (_req, res) =>
  res.json((db.pages || []).filter((p) => p.published).map(({ bodyHtml, ...rest }) => rest)));

app.get('/api/pages/:handle', (req, res) => {
  const page = (db.pages || []).find((p) => p.handle === req.params.handle && p.published);
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

app.put('/api/pages/:handle', auth, (req, res) => {
  const list = db.pages || [];
  const i = list.findIndex((p) => p.handle === req.params.handle);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  /* handle is the page's identity and its URL -- editing copy must not move it. */
  const { handle, ...patch } = req.body || {};
  list[i] = { ...list[i], ...patch, handle: list[i].handle, updatedAt: new Date().toISOString() };
  save();
  res.json(list[i]);
});

/* ------------------------------------------------------------------ reviews */

/* Reviews arrive from the public, so nothing is shown until an admin approves
   it. `video` accepts a YouTube or Instagram link as well as a file URL --
   see normaliseVideo() for why hosting the files here is not the default. */
const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

/** Turns a share link into something embeddable, and rejects anything else. */
function normaliseVideo(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'youtube', id: yt[1], embed: `https://www.youtube-nocookie.com/embed/${yt[1]}`, url };

  const ig = url.match(/instagram\.com\/(?:p|reel|reels)\/([\w-]+)/);
  if (ig) return { kind: 'instagram', id: ig[1], embed: `https://www.instagram.com/reel/${ig[1]}/embed`, url };

  /* A direct file we host ourselves (Cloudinary). Allowed, but bandwidth-heavy. */
  if (/^https:\/\/[^\s]+\.(mp4|webm|mov)(\?|$)/i.test(url)) return { kind: 'file', embed: url, url };

  return undefined;                       /* undefined = supplied but unusable */
}

app.get('/api/reviews', (req, res) => {
  const { product, limit } = req.query;
  let list = (db.reviews || []).filter((r) => r.status === 'approved');
  if (product) list = list.filter((r) => r.productId === product);
  list = list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
    || String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(limit ? list.slice(0, Number(limit) || 12) : list);
});

app.get('/api/reviews/all', auth, (req, res) => {
  const { status } = req.query;
  const list = (db.reviews || []).filter((r) => !status || status === 'all' || r.status === status);
  res.json([...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
});

app.post('/api/reviews', (req, res) => {
  const { name, rating, title, body, productId, photo, video } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Please tell us your name.' });
  if (!String(body || '').trim()) return res.status(400).json({ error: 'Please write a few words.' });

  const stars = Number(rating);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Please give a rating between 1 and 5.' });
  }

  const media = normaliseVideo(video);
  if (media === undefined) {
    return res.status(400).json({ error: 'That video link is not one we can show. Use a YouTube or Instagram link.' });
  }

  const review = {
    id: uid('rev'),
    name: String(name).trim().slice(0, 60),
    rating: Math.round(stars),
    title: String(title || '').trim().slice(0, 120),
    body: String(body).trim().slice(0, 1500),
    productId: productId || null,
    photo: String(photo || '') || null,
    video: media,
    /* Never trusted from the client -- an approved review is an editorial act. */
    status: 'pending',
    featured: false,
    createdAt: new Date().toISOString(),
  };
  db.reviews = [review, ...(db.reviews || [])];
  save();
  res.status(201).json({ ok: true, message: 'Thank you. Your review will appear once we have read it.' });
});

app.put('/api/reviews/:id', auth, (req, res) => {
  const patch = { ...req.body };
  if (patch.status && !REVIEW_STATUSES.includes(patch.status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  if (patch.video !== undefined) {
    const media = normaliseVideo(patch.video);
    if (media === undefined) return res.status(400).json({ error: 'That video link cannot be embedded.' });
    patch.video = media;
  }
  const updated = upsert('reviews', req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  syncProductRating(updated.productId);
  res.json(updated);
});

app.delete('/api/reviews/:id', auth, (req, res) => {
  const gone = (db.reviews || []).find((r) => r.id === req.params.id);
  write('reviews', (db.reviews || []).filter((r) => r.id !== req.params.id));
  save();
  syncProductRating(gone?.productId);
  res.json({ ok: true });
});

/** A product's star rating is derived from approved reviews, never typed in. */
function syncProductRating(productId) {
  if (!productId) return;
  const mine = (db.reviews || []).filter((r) => r.productId === productId && r.status === 'approved');
  const avg = mine.length ? mine.reduce((s, r) => s + (r.rating || 0), 0) / mine.length : 0;
  upsert('products', productId, { rating: Math.round(avg * 10) / 10, reviews: mine.length });
}

/* ----------------------------------------------------------------- returns */

const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'picked_up', 'refunded', 'replaced', 'closed'];
const RETURN_WINDOW_DAYS = 7;

/* Mirrors the published Return & Refund Policy. Kept here as the single source
   of truth so the UI and the API cannot disagree about eligibility. */
function returnEligibility(order) {
  if (!order) return { ok: false, reason: 'We could not find that order.' };
  if (order.status === 'cancelled') return { ok: false, reason: 'That order was cancelled.' };
  if (order.status !== 'delivered') {
    return { ok: false, reason: 'A return can be raised once the order has been delivered.' };
  }
  const delivered = new Date(order.deliveredAt || order.updatedAt || order.createdAt).getTime();
  const days = Math.floor((Date.now() - delivered) / DAY);
  if (days > RETURN_WINDOW_DAYS) {
    return { ok: false, reason: `The ${RETURN_WINDOW_DAYS}-day return window closed ${days - RETURN_WINDOW_DAYS} day(s) ago.` };
  }
  if ((db.returns || []).some((r) => r.orderId === order.id && !['rejected', 'closed'].includes(r.status))) {
    return { ok: false, reason: 'A return is already open for this order.' };
  }
  return { ok: true, daysLeft: RETURN_WINDOW_DAYS - days };
}

app.get('/api/account/returns', requireCustomer, (req, res) => {
  const mine = (db.returns || [])
    .filter((r) => r.customerId === req.customer.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(mine);
});

app.post('/api/account/returns', requireCustomer, (req, res) => {
  const { orderId, reason, details, items, photos } = req.body || {};
  const order = (db.orders || []).find((o) => o.id === orderId);

  /* Ownership is checked before eligibility, so a stranger cannot learn the
     delivery state of somebody else's order by probing this endpoint. */
  const mine = order && (order.customerId === req.customer.id
    || (order.customer?.email || '').toLowerCase() === (req.customer.email || '').toLowerCase());
  if (!mine) return res.status(404).json({ error: 'We could not find that order.' });

  const eligible = returnEligibility(order);
  if (!eligible.ok) return res.status(400).json({ error: eligible.reason });
  if (!String(reason || '').trim()) return res.status(400).json({ error: 'Please tell us what went wrong.' });

  const rma = {
    id: uid('ret'),
    number: `RMA-${String((db.returns || []).length + 1).padStart(4, '0')}`,
    orderId: order.id,
    orderNumber: order.number,
    customerId: req.customer.id,
    customerName: req.customer.name,
    customerEmail: req.customer.email,
    reason: String(reason).trim().slice(0, 120),
    details: String(details || '').trim().slice(0, 1200),
    items: Array.isArray(items) ? items.slice(0, 20) : [],
    photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
    status: 'requested',
    resolution: '',
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), status: 'requested', note: 'Raised by the customer.' }],
  };
  db.returns = [rma, ...(db.returns || [])];
  save();
  res.status(201).json(rma);
});

app.get('/api/returns', auth, (req, res) => {
  const { status } = req.query;
  const list = (db.returns || []).filter((r) => !status || status === 'all' || r.status === status);
  res.json([...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
});

app.put('/api/returns/:id', auth, (req, res) => {
  const { status, resolution, note } = req.body || {};
  if (status && !RETURN_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });

  const current = (db.returns || []).find((r) => r.id === req.params.id);
  if (!current) return res.status(404).json({ error: 'Not found' });

  const patch = {};
  if (resolution !== undefined) patch.resolution = String(resolution).slice(0, 400);
  if (status && status !== current.status) {
    patch.status = status;
    patch.history = [...(current.history || []), {
      at: new Date().toISOString(), status, note: String(note || '').slice(0, 300) || `Moved to ${status}.`,
    }];
  }
  res.json(upsert('returns', req.params.id, patch));
});

/* Tells the account page whether to offer the button at all. */
app.get('/api/account/orders/:id/returnable', requireCustomer, (req, res) => {
  const order = (db.orders || []).find((o) => o.id === req.params.id);
  const mine = order && (order.customerId === req.customer.id
    || (order.customer?.email || '').toLowerCase() === (req.customer.email || '').toLowerCase());
  if (!mine) return res.status(404).json({ error: 'We could not find that order.' });
  res.json(returnEligibility(order));
});

/* ------------------------------------------------------------- hero slides */

app.get('/api/slides', (req, res) => {
  if (req.query.all === '1') return res.json(db.slides || []);
  const today = dayKey(Date.now());
  res.json((db.slides || [])
    .filter((s) => s.active && (!s.startDate || s.startDate <= today) && (!s.endDate || s.endDate >= today))
    .sort((a, b) => (a.order || 0) - (b.order || 0)));
});

app.post('/api/slides', auth, (req, res) => {
  const slide = {
    id: uid('sld'),
    eyebrow: '', title: 'New slide', subtitle: '',
    cta: 'Shop now', link: '/shop',
    image: '', mobileImage: '', align: 'left', tone: 'dark',
    active: false, order: (db.slides || []).length,
    startDate: '', endDate: '',
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  db.slides = [...(db.slides || []), slide];
  save();
  res.status(201).json(slide);
});

app.put('/api/slides/:id', auth, (req, res) => {
  const updated = upsert('slides', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

app.delete('/api/slides/:id', auth, (req, res) => {
  write('slides', (db.slides || []).filter((s) => s.id !== req.params.id));
  save();
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- bookings */
app.get('/api/services', (_req, res) =>
  res.json((db.services || []).filter((s) => s.active !== false)));

/* Consultation scheduling, all of it admin-editable under settings.consult.
   Slots and the "closed Sunday morning" rule used to be hardcoded here, which
   meant Swati could not change her own hours without a deploy. */
const CONSULT_DEFAULTS = {
  slots: ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
  /* 0 = Sunday. Days not listed are closed. */
  openDays: [1, 2, 3, 4, 5, 6],
  /* No booking inside this many hours from now -- stops someone booking a call
     that starts in ten minutes. */
  leadHours: 12,
  /* How far ahead the calendar opens. */
  horizonDays: 30,
  /* Dates Swati has blocked out, as YYYY-MM-DD. */
  blockedDates: [],
  meetingNote: 'You will receive a video call link by email and WhatsApp before your slot.',
};

const consultSettings = () => ({ ...CONSULT_DEFAULTS, ...(db.settings?.consult || {}) });

/** A slot is taken if any live booking already holds it. */
const slotTaken = (date, slot) =>
  (db.bookings || []).some((b) => b.date === date && b.slot === slot && b.status !== 'cancelled');

app.get('/api/bookings/availability', (req, res) => {
  const cfg = consultSettings();
  const date = req.query.date || dayKey(Date.now());
  const day = new Date(`${date}T00:00:00`).getDay();

  const open = cfg.openDays.includes(day) && !cfg.blockedDates.includes(date);
  /* Compared as timestamps so the lead time is honest across midnight. */
  const earliest = Date.now() + cfg.leadHours * 3600 * 1000;
  const latest = Date.now() + cfg.horizonDays * DAY;

  res.json({
    date,
    open,
    note: cfg.meetingNote,
    slots: cfg.slots.map((slot) => {
      const at = new Date(`${date}T${slot}:00`).getTime();
      return {
        slot,
        available: open && !slotTaken(date, slot) && at > earliest && at < latest,
        reason: !open ? 'closed'
          : slotTaken(date, slot) ? 'booked'
          : at <= earliest ? 'too soon'
          : at >= latest ? 'too far ahead' : null,
      };
    }),
  });
});

/* Which dates to even offer in the picker. */
app.get('/api/bookings/calendar', (_req, res) => {
  const cfg = consultSettings();
  const out = [];
  for (let i = 0; i < cfg.horizonDays; i++) {
    const d = new Date(Date.now() + i * DAY);
    const date = dayKey(d);
    const open = cfg.openDays.includes(d.getDay()) && !cfg.blockedDates.includes(date);
    const free = open && cfg.slots.some((slot) =>
      !slotTaken(date, slot) && new Date(`${date}T${slot}:00`).getTime() > Date.now() + cfg.leadHours * 3600 * 1000);
    out.push({ date, open, free });
  }
  res.json({ days: out, note: cfg.meetingNote });
});

/* ---- services: price, duration and visibility, editable by the admin ---- */
app.get('/api/services/all', auth, (_req, res) => res.json(db.services || []));

app.post('/api/services', auth, (req, res) => {
  const svc = {
    id: uid('svc'), name: 'New consultation', minutes: 30, price: 0,
    description: '', mode: 'Video call', active: true,
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  db.services = [...(db.services || []), svc];
  save();
  res.status(201).json(svc);
});

app.put('/api/services/:id', auth, (req, res) => {
  const updated = upsert('services', req.params.id, req.body);
  updated ? res.json(updated) : res.status(404).json({ error: 'Not found' });
});

app.delete('/api/services/:id', auth, (req, res) => {
  write('services', (db.services || []).filter((s) => s.id !== req.params.id));
  save();
  res.json({ ok: true });
});

app.get('/api/bookings', auth, (req, res) => {
  const { status, date } = req.query;
  let list = db.bookings;
  if (status && status !== 'all') list = list.filter((b) => b.status === status);
  if (date) list = list.filter((b) => b.date === date);
  res.json(list);
});

app.post('/api/bookings', optionalCustomer, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const date = String(body.date || '');
  const slot = String(body.slot || '');

  if (!name || !phone || !date || !slot) {
    return res.status(400).json({ error: 'Name, phone, date and time slot are required.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required — the call link is sent there.' });
  }

  /* Re-check availability rather than trusting the slot the browser offered:
     the page may have been open for an hour. */
  const cfg = consultSettings();
  const day = new Date(`${date}T00:00:00`).getDay();
  if (!cfg.openDays.includes(day) || cfg.blockedDates.includes(date)) {
    return res.status(409).json({ error: 'We are not taking calls on that day.' });
  }
  if (!cfg.slots.includes(slot)) {
    return res.status(400).json({ error: 'That is not one of our consultation times.' });
  }
  if (new Date(`${date}T${slot}:00`).getTime() < Date.now() + cfg.leadHours * 3600 * 1000) {
    return res.status(409).json({ error: `Please book at least ${cfg.leadHours} hours ahead.` });
  }
  if (slotTaken(date, slot)) {
    return res.status(409).json({ error: 'That slot was just taken. Please pick another.' });
  }

  const svc = (db.services || []).find((x) => x.id === body.serviceId && x.active !== false);
  if (!svc) return res.status(400).json({ error: 'Please choose a consultation type.' });

  /* Every field is set here from the server's own records. The old version
     spread the request body last, so a caller could post status:'confirmed'
     and price:0 and book a paid consultation for nothing. */
  const booking = {
    id: uid('bkg'),
    number: `CON-${String((db.bookings || []).length + 1).padStart(4, '0')}`,
    name, phone, email,
    date, slot,
    serviceId: svc.id,
    service: svc.name,
    minutes: svc.minutes,
    price: svc.price,
    mode: svc.mode || 'Video call',
    concern: String(body.concern || '').slice(0, 600),
    birthDetails: String(body.birthDetails || '').slice(0, 300),
    customerId: req.customer?.id || null,
    /* Free calls are confirmed immediately; a paid one waits for payment. */
    status: svc.price > 0 ? 'awaiting_payment' : 'pending',
    paid: svc.price === 0,
    meetingLink: '',
    notes: '',
    source: 'Website',
    createdAt: new Date().toISOString(),
  };

  db.bookings = [...(db.bookings || []), booking];
  save();
  res.status(201).json({ ...booking, note: cfg.meetingNote });
});

app.put('/api/bookings/:id', auth, (req, res) => {
  const b = upsert('bookings', req.params.id, req.body);
  b ? res.json(b) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/bookings/:id', auth, (req, res) => {
  write('bookings', db.bookings.filter((b) => b.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- analytics */
/* Automated traffic must not land in the analytics. Headless browsers and
   crawlers announce themselves in the user agent, and counting them makes the
   numbers useless -- an afternoon of automated testing put 800 fake visits in
   here and reported them as real people. */
const BOT_UA = /HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider|curl\/|wget|python-requests|node-fetch|axios|Lighthouse|PhantomJS|Selenium/i;

app.post('/api/analytics/visit', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  /* Answer 200 either way -- a bot being told it was filtered is noise, and the
     browser has nothing useful to do with the information. */
  if (!ua || BOT_UA.test(ua)) return res.json({ ok: true, counted: false });

  const { path: p = '/', session = 'anon', source = 'Direct', device = 'desktop', automated } = req.body || {};

  /* Chrome's current headless mode sends an ordinary Chrome user-agent, so the
     string above no longer catches a browser being driven by a script -- my own
     testing put 22 phantom visits in this table before I noticed. Every
     automation driver sets navigator.webdriver, and no ordinary browser does,
     so the page reports it and we drop those. */
  if (automated === true) return res.json({ ok: true, counted: false });

  db.visits.push({ id: uid('vst'), at: new Date().toISOString(), path: p, session, source, device, ua: ua.slice(0, 180) });
  if (db.visits.length > 60000) db.visits.splice(0, db.visits.length - 60000);
  save();
  res.json({ ok: true });
});

app.get('/api/analytics/summary', auth, (req, res) => {
  const days = Math.min(365, Math.max(7, +req.query.days || 30));
  const now = Date.now();
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;

  const inRange = (t, a, b) => t >= a && t < b;
  const visits = db.visits.map((v) => ({ ...v, t: new Date(v.at).getTime() }));
  const orders = db.orders.map((o) => ({ ...o, t: new Date(o.createdAt).getTime() }));

  const curVisits = visits.filter((v) => inRange(v.t, from, now + 1));
  const prevVisits = visits.filter((v) => inRange(v.t, prevFrom, from));
  const curOrders = orders.filter((o) => inRange(o.t, from, now + 1) && o.status !== 'cancelled');
  const prevOrders = orders.filter((o) => inRange(o.t, prevFrom, from) && o.status !== 'cancelled');

  const rev = (l) => l.reduce((t, o) => t + o.total, 0);
  const uniq = (l) => new Set(l.map((v) => v.session)).size;
  const delta = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : a ? 100 : 0);

  // daily series
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY);
    const dv = curVisits.filter((v) => dayKey(v.t) === key);
    const dor = curOrders.filter((o) => dayKey(o.t) === key);
    series.push({
      date: key,
      label: new Date(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      visits: dv.length,
      visitors: new Set(dv.map((v) => v.session)).size,
      orders: dor.length,
      revenue: rev(dor),
    });
  }

  const byStatus = {};
  for (const st of [...FLOW, 'cancelled']) byStatus[st] = db.orders.filter((o) => o.status === st).length;

  const count = (list, key) =>
    Object.entries(list.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {}))
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  const productSales = {};
  for (const o of curOrders) {
    for (const it of o.items) {
      const s = (productSales[it.name] ||= { name: it.name, units: 0, revenue: 0, slug: it.slug, image: it.image });
      s.units += it.qty;
      s.revenue += it.price * it.qty;
    }
  }

  const catSales = {};
  for (const o of curOrders) {
    for (const it of o.items) {
      const p = db.products.find((x) => x.id === it.productId);
      const cat = db.categories?.find((c) => c.slug === p?.category);
      const key = cat?.name || 'Other';
      catSales[key] = (catSales[key] || 0) + it.price * it.qty;
    }
  }

  const todayKey = dayKey(now);
  res.json({
    range: { days, from: dayKey(from), to: todayKey },
    kpis: {
      visits: { value: curVisits.length, delta: delta(curVisits.length, prevVisits.length) },
      visitors: { value: uniq(curVisits), delta: delta(uniq(curVisits), uniq(prevVisits)) },
      orders: { value: curOrders.length, delta: delta(curOrders.length, prevOrders.length) },
      revenue: { value: rev(curOrders), delta: delta(rev(curOrders), rev(prevOrders)) },
      aov: {
        value: curOrders.length ? Math.round(rev(curOrders) / curOrders.length) : 0,
        delta: delta(curOrders.length ? rev(curOrders) / curOrders.length : 0, prevOrders.length ? rev(prevOrders) / prevOrders.length : 0),
      },
      conversion: {
        value: curVisits.length ? +((curOrders.length / uniq(curVisits)) * 100).toFixed(2) : 0,
        delta: 0,
      },
      bookings: {
        value: db.bookings.filter((b) => new Date(b.createdAt).getTime() >= from).length,
        delta: delta(
          db.bookings.filter((b) => new Date(b.createdAt).getTime() >= from).length,
          db.bookings.filter((b) => { const t = new Date(b.createdAt).getTime(); return t >= prevFrom && t < from; }).length),
      },
    },
    fulfilment: {
      placed: byStatus.placed, confirmed: byStatus.confirmed, packed: byStatus.packed,
      in_transit: byStatus.in_transit, delivered: byStatus.delivered, cancelled: byStatus.cancelled,
      liveShipments: byStatus.packed + byStatus.in_transit,
    },
    series,
    sources: count(curVisits, 'source'),
    devices: count(curVisits, 'device'),
    topPages: count(curVisits, 'path').slice(0, 7),
    topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    categoryRevenue: Object.entries(catSales).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    today: {
      visits: curVisits.filter((v) => dayKey(v.t) === todayKey).length,
      orders: curOrders.filter((o) => dayKey(o.t) === todayKey).length,
      revenue: rev(curOrders.filter((o) => dayKey(o.t) === todayKey)),
    },
    lowStock: db.products.filter((p) => p.stock <= 8 && p.active !== false)
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock })).slice(0, 6),
    recentOrders: db.orders.slice(0, 6),
    upcomingBookings: db.bookings
      .filter((b) => b.date >= todayKey && b.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
      .slice(0, 5),
  });
});

/* The demo reset endpoint used to reseed the whole database from seed.js. It is
   gone deliberately: it replaced every collection wholesale, which now includes
   `admins`, so one call would have deleted the only login and locked everyone
   out of a live store. Reseeding is a deliberate act -- run `npm run seed`
   against a local db.json, never against the production database over HTTP. */

app.get('/api/health', (_req, res) => res.json({ ok: true, products: db.products.length }));

/* Serve the built SPA when it exists (single-command demo deploy). */
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

/* Storage has to be connected and loaded before the first request lands. */
const info = await initDb();
const summary = (counts) =>
  Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'empty';

if (info.mode === 'cockroach') {
  console.log(`  CockroachDB ->  ${info.db}  (${summary(info.counts)})`);
} else if (info.mode === 'mongo') {
  console.log(`  MongoDB     ->  ${info.db}  (${summary(info.counts)})`);
} else {
  console.log('  Storage     ->  data/db.json  (set DATABASE_URL to use CockroachDB)');
}
console.log(
  cloud.configured
    ? `  Cloudinary  ->  ${cloud.cloud}  (uploads go to the CDN)`
    : '  Cloudinary  ->  not configured, uploads stay on local disk'
);

/* Seeds policy and about copy, but never overwrites a page that already exists
   -- otherwise every restart would undo the owner's edits. */
const { PAGES } = await import('./content.js');
const byHandle = new Map((db.pages || []).map((p) => [p.handle, p]));
const missing = PAGES.filter((p) => !byHandle.has(p.handle));

/* A page the owner has never signed off (reviewed === false) is still ours to
   correct, so edits to content.js reach the database. The moment it is saved in
   the admin it is marked reviewed and this stops touching it. */
const refreshable = PAGES.filter((p) => byHandle.get(p.handle)?.reviewed === false
  && JSON.stringify(byHandle.get(p.handle).sections) !== JSON.stringify(p.sections));

if (missing.length || refreshable.length) {
  const refresh = new Map(refreshable.map((p) => [p.handle, p]));
  db.pages = [
    ...(db.pages || []).map((p) => (refresh.has(p.handle) ? { ...p, ...refresh.get(p.handle) } : p)),
    ...missing.map((p) => ({ id: uid('pg'), published: true, createdAt: new Date().toISOString(), ...p })),
  ];
  await saveNow();
  if (missing.length) console.log(`  Pages       ->  seeded ${missing.map((p) => p.handle).join(', ')}`);
  if (refreshable.length) console.log(`  Pages       ->  refreshed unreviewed drafts: ${refreshable.map((p) => p.handle).join(', ')}`);
}
const unreviewed = (db.pages || []).filter((p) => p.reviewed === false).map((p) => p.handle);
if (unreviewed.length) {
  console.log(`  ! Draft copy awaiting your review: ${unreviewed.join(', ')}`);
  console.log('    Edit under Admin > Pages before the store opens.');
}

/* Creates the first admin if there is none. A generated password is printed
   exactly once -- it is not recoverable afterwards, only resettable. */
const admin = await ensureAdmin();
if (admin.created && admin.generated) {
  console.log('\n  ┌─ FIRST-RUN ADMIN ─────────────────────────────────────');
  console.log(`  │  email    ${admin.email}`);
  console.log(`  │  password ${admin.password}`);
  console.log('  │  Shown once. Sign in and change it immediately.');
  console.log('  └───────────────────────────────────────────────────────\n');
} else if (admin.created) {
  console.log(`  Admin       ->  created ${admin.email} from ADMIN_PASSWORD`);
}

app.listen(PORT, () => console.log(`  Sukoon API  ->  http://localhost:${PORT}`));
