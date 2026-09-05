/**
 * FreeAstroAPI client — https://www.freeastroapi.com/docs
 *
 * The key never leaves this file. Everything the browser sees comes back
 * through our own routes in index.js.
 *
 * The plan we are on allows 80 requests a day at one per second, which is the
 * single most important fact about this integration. Three things follow from
 * it, and they are why this is not simply a fetch wrapper:
 *
 *   1. Every answer is cached by the birth moment itself, so a chart is drawn
 *      once and never again — not once per user, once per birth. Two people
 *      born in the same minute in the same city cost one call between them.
 *   2. Calls are serialised with a gap, because two shoppers pressing the
 *      button together would otherwise trip the per-second limit.
 *   3. A daily counter stops us short of the ceiling on purpose, so the
 *      failure is a sentence we wrote rather than a wall of 429s.
 */
import crypto from 'node:crypto';

import { db, save } from './db.js';

const BASE = 'https://api.freeastroapi.com';
const KEY = process.env.FREE_ASTRO_API_KEY || '';

/* Held under the published ceiling so a burst never lands on a hard 429, and
   so the owner's own testing cannot lock customers out for the rest of a day. */
const DAILY_BUDGET = Number(process.env.FREE_ASTRO_DAILY_BUDGET || 70);
const MIN_GAP_MS = 1100;   // the documented limit is one request per second
const TIMEOUT_MS = 20000;

export const astroEnabled = () => Boolean(KEY);

export class AstroError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/* ------------------------------------------------------------ daily budget */
const today = () => new Date().toISOString().slice(0, 10);
let spend = { day: today(), used: 0 };

const budgetLeft = () => {
  if (spend.day !== today()) spend = { day: today(), used: 0 };
  return DAILY_BUDGET - spend.used;
};

export const quota = () => ({
  used: spend.day === today() ? spend.used : 0,
  budget: DAILY_BUDGET,
  enabled: astroEnabled(),
});

/* -------------------------------------------------------------- the queue */
/* One call at a time, spaced. Callers just await; they never see the queue. */
let chain = Promise.resolve();
let lastAt = 0;

function serialise(job) {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { return await job(); } finally { lastAt = Date.now(); }
  });
  /* The chain must survive a rejected job, or every later call inherits it. */
  chain = run.then(() => {}, () => {});
  return run;
}

async function call(path, { method = 'POST', body, raw = false } = {}) {
  if (!KEY) throw new AstroError('Birth charts are not switched on yet.', 503);
  if (budgetLeft() <= 0) {
    throw new AstroError(
      'We have reached today’s limit for new charts. Please try again tomorrow — it will only take a moment then.',
      429,
    );
  }

  return serialise(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { 'x-api-key': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      spend.used += 1;

      if (res.status === 429) {
        throw new AstroError('Charts are busy for a moment. Please try again shortly.', 429);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[astro] ${path} -> ${res.status} ${text.slice(0, 300)}`);
        throw new AstroError('We could not draw the chart just now. Please try again.', 502);
      }
      return raw ? res.text() : res.json();
    } catch (e) {
      if (e instanceof AstroError) throw e;
      if (e.name === 'AbortError') throw new AstroError('The chart service took too long. Please try again.', 504);
      console.error('[astro] network', e.message);
      throw new AstroError('We could not reach the chart service. Please try again.', 502);
    } finally {
      clearTimeout(timer);
    }
  });
}

/* ------------------------------------------------------------------ cache */
/* Keyed by the birth moment, not by the person. Stored in the database so it
   survives a restart — the whole point is never to pay for the same sky twice. */
export const birthKey = (b) => crypto.createHash('sha1')
  .update([b.year, b.month, b.day, b.hour, b.minute, b.lat, b.lng, b.tz].join('|'))
  .digest('hex')
  .slice(0, 20);

/* --------------------------------------------------------------- city search */
/* Cached hard: the same few hundred Indian towns get typed over and over. */
const cityCache = new Map();

export async function searchCity(q) {
  const term = String(q || '').trim().toLowerCase();
  if (term.length < 2) return [];
  if (cityCache.has(term)) return cityCache.get(term);

  const data = await call(`/api/v2/geo/search?q=${encodeURIComponent(term)}&limit=6`, { method: 'GET' });
  const rows = (data?.results || []).map((r) => ({
    name: r.name,
    state: r.state || '',
    district: r.district || '',
    country: r.country || '',
    lat: r.lat,
    lng: r.lng,
    tz: r.timezone || 'Asia/Kolkata',
  }));
  if (cityCache.size > 500) cityCache.clear();
  cityCache.set(term, rows);
  return rows;
}

/**
 * The chart itself: planetary positions plus the drawn kundli, cached together.
 *
 * `chart_only` strips the API's own title block — the page draws its own
 * heading, and two headings stacked read as a mistake. The colours are passed
 * in so the kundli belongs to the page it sits on instead of arriving as a
 * stock graphic.
 */
export async function vedicChart(birth, theme = {}) {
  const key = birthKey(birth);
  const hit = (db.charts || []).find((c) => c.id === key);
  if (hit?.svg) return { ...hit, cache: 'hit' };

  const payload = {
    year: birth.year, month: birth.month, day: birth.day,
    hour: birth.hour, minute: birth.minute,
    city: birth.city || undefined,
    lat: birth.lat, lng: birth.lng,
    tz_str: birth.tz || 'Asia/Kolkata',
    ayanamsha: 'lahiri',
    house_system: 'whole_sign',
    node_type: 'mean',
  };

  const data = await call('/api/v2/vedic/chart', { body: payload });

  const svg = await call('/api/v2/vedic/visual/chart', {
    raw: true,
    body: {
      ...payload,
      divisions: [1],
      chart_style: 'north_indian',
      format: 'svg',
      size: 700,
      theme_type: 'light',
      body_types: ['ascendant', 'classical_grahas', 'nodes'],
      display_settings: { chart_only: true, sign_labels: true, house_labels: false, division_badge: false },
      custom_theme: {
        background: theme.background || '#FFFFFF',
        panel_background: theme.panel || '#FFFDF8',
        panel_border: theme.line || '#E3DACB',
        grid: theme.grid || '#C09A4A',
        outer_line: theme.outline || '#7A1717',
        sign_text: theme.sign || '#7A1717',
        body_text: theme.body || '#1A1A17',
        ascendant_text: theme.accent || '#0B7285',
      },
      chart_config: {
        sign_font_size: 24, body_font_size: 18, body_font_weight: '500',
        grid_line_width: 2, outer_line_width: 3, panel_padding: 14,
      },
    },
  });

  const row = {
    id: key,
    data,
    svg: String(svg || '').slice(0, 400000),
    birth: { ...birth, city: birth.city || '' },
    computedAt: new Date().toISOString(),
  };
  /* Insert-or-replace: index.js's upsert only patches rows that already
     exist, and the first chart for a birth never does. */
  const list = db.charts || [];
  const i = list.findIndex((c) => c.id === key);
  db.charts = i === -1 ? [...list, row] : list.map((c) => (c.id === key ? row : c));
  save();

  return { ...row, cache: 'miss' };
}
