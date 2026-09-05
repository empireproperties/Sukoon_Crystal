/* Admin authentication.
 *
 * Replaces the demo login that shipped a hardcoded email, password and a
 * never-expiring bearer token in the client bundle.
 *
 *   passwords  scrypt with a per-user random salt, compared in constant time
 *   tokens     HMAC-SHA256 signed, carrying an expiry and a revocation epoch
 *   bootstrap  first boot creates one admin; the password is never a default
 *
 * Tokens are stateless, so there is no session table to grow. Revocation works
 * through `epoch`: bumping it on the admin record invalidates every token that
 * was already issued, which is what a password change does.
 */
import crypto from 'crypto';
import { db, save, uid } from './db.js';

/* scrypt parameters. N=16384 keeps a hash around 60-100ms on a small VM --
   slow enough to make guessing expensive, fast enough for an admin login. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------- password */

const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
      (err, key) => (err ? reject(err) : resolve(key)))
  );

/** Returns `scrypt$N$r$p$salt$hash`, everything needed to verify later. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, N, r, p, saltB64, hashB64] = stored.split('$');
  let expected;
  try {
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  const key = await new Promise((resolve) =>
    crypto.scrypt(password, Buffer.from(saltB64, 'base64'), expected.length,
      { N: Number(N), r: Number(r), p: Number(p) },
      (err, k) => resolve(err ? null : k))
  );
  /* timingSafeEqual throws on a length mismatch, so guard before calling it. */
  return Boolean(key) && key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** Rejects the passwords that make an admin panel trivially guessable. */
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Password needs an upper and a lower case letter.';
  if (!/[0-9]/.test(password)) return 'Password needs a digit.';
  if (/^(sukoon|password|admin|welcome|qwerty)/i.test(password)) return 'That password is too easy to guess.';
  return null;
}

/* ----------------------------------------------------------------- secret */

/* The HMAC key for tokens. AUTH_SECRET is the right place for it; when it is
   missing we generate one and persist it so a fresh install still gets a
   random key rather than a predictable fallback. */
let secret = null;

export function getSecret() {
  if (secret) return secret;
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    secret = Buffer.from(fromEnv, 'utf8');
    return secret;
  }
  const settings = db.settings || {};
  if (settings.authSecret) {
    secret = Buffer.from(settings.authSecret, 'hex');
    return secret;
  }
  const generated = crypto.randomBytes(48);
  db.settings = { ...settings, authSecret: generated.toString('hex') };
  save();
  console.warn('  ! AUTH_SECRET not set -- generated one and stored it in the database.');
  console.warn('    Set AUTH_SECRET in server/.env to control it yourself.');
  secret = generated;
  return secret;
}

/* ------------------------------------------------------------------ token */

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', getSecret()).update(payload).digest();

/* Which collection an audience authenticates against. `aud` is inside the
   signed payload, so a customer token can never be replayed against an admin
   route even though both are signed with the same key. */
const AUDIENCES = {
  admin: 'admins',
  customer: 'customers',
};

/** `<base64url payload>.<base64url hmac>` -- compact, and verifiable offline. */
export function issueToken(user, audience = 'admin') {
  const body = b64url(JSON.stringify({
    sub: user.id,
    email: user.email,
    name: user.name,
    aud: audience,
    epoch: user.epoch || 0,
    exp: Date.now() + TOKEN_TTL_MS,
  }));
  return `${body}.${b64url(sign(body))}`;
}

/**
 * Verifies signature, audience, expiry and revocation epoch. Returns the user
 * record, or null for anything that does not check out.
 */
export function verifyToken(token, audience = 'admin') {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  let given;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  const expected = sign(body);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;

  /* Tokens minted before audiences existed carry no `aud`; treat them as admin
     so an in-flight session is not silently downgraded. */
  if ((payload.aud || 'admin') !== audience) return null;

  const collection = AUDIENCES[audience];
  if (!collection) return null;

  const user = (db[collection] || []).find((u) => u.id === payload.sub);
  /* A password change bumps epoch, which retires every token issued before it. */
  if (!user || user.active === false || (user.epoch || 0) !== (payload.epoch || 0)) return null;
  return user;
}

export const tokenTtlMs = () => TOKEN_TTL_MS;

/* ----------------------------------------------------------- rate limiting */

/* A login endpoint with no throttle is a password oracle. Keyed per IP+email so
   one attacker cannot lock out a real admin by guessing at their address. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginBlockedFor(key) {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (Date.now() > rec.until) { attempts.delete(key); return 0; }
  return rec.count >= MAX_ATTEMPTS ? Math.ceil((rec.until - Date.now()) / 1000) : 0;
}

export function recordFailure(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.until) attempts.set(key, { count: 1, until: now + WINDOW_MS });
  else { rec.count++; rec.until = now + WINDOW_MS; }
}

export const clearFailures = (key) => attempts.delete(key);

/* Bounded cleanup so a flood of distinct keys cannot grow the map forever. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (now > v.until) attempts.delete(k);
}, WINDOW_MS).unref();

/* -------------------------------------------------------------- bootstrap */

/**
 * Ensures exactly one admin exists. Seeds from ADMIN_EMAIL / ADMIN_PASSWORD
 * when given; otherwise generates a random password and prints it once, so
 * there is never a known default to guess.
 */
export async function ensureAdmin() {
  const admins = db.admins || [];
  if (admins.length) return { created: false, count: admins.length };

  const email = (process.env.ADMIN_EMAIL || 'sukoon.crystalsolutions@gmail.com').toLowerCase().trim();
  const supplied = process.env.ADMIN_PASSWORD;
  const password = supplied || `Sukoon-${crypto.randomBytes(9).toString('base64url')}`;

  const admin = {
    id: uid('adm'),
    email,
    name: process.env.ADMIN_NAME || 'Swati Khanna',
    passwordHash: await hashPassword(password),
    epoch: 0,
    active: true,
    createdAt: new Date().toISOString(),
    mustChangePassword: !supplied,
  };
  db.admins = [...admins, admin];
  save();

  return { created: true, email, password, generated: !supplied };
}

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Express middleware: populates req.admin or answers 401. */
export const requireAuth = (req, res, next) => {
  const token = bearer(req);
  const admin = token ? verifyToken(token, 'admin') : null;
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  req.admin = admin;
  next();
};

/** Express middleware: populates req.customer or answers 401. */
export const requireCustomer = (req, res, next) => {
  const token = bearer(req);
  const customer = token ? verifyToken(token, 'customer') : null;
  if (!customer) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.customer = customer;
  next();
};

/** Populates req.customer when a valid customer token is present, else nothing. */
export const optionalCustomer = (req, _res, next) => {
  const token = bearer(req);
  req.customer = token ? verifyToken(token, 'customer') : null;
  next();
};

/** What the client is allowed to see about an admin. */
export const publicAdmin = (a) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  mustChangePassword: Boolean(a.mustChangePassword),
});

/** What a customer is allowed to see about themselves. Never the hash. */
export const publicCustomer = (c) => ({
  id: c.id,
  email: c.email,
  name: c.name,
  phone: c.phone || '',
  addresses: c.addresses || [],
  /* Birth details and the chart drawn from them. Kept on the customer so the
     profile is one place: who they are, where to ship, and their kundli. */
  birth: c.birth || null,
  chartKey: c.chartKey || '',
  createdAt: c.createdAt,
});
