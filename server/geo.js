/* Address lookup helpers.
 *
 * Two free services, neither needing an API key:
 *
 *   India Post   a PIN code -> locality, district, state. Authoritative for
 *                Indian addresses and the more useful of the two, because a
 *                shopper knows their PIN even when GPS puts them in the wrong
 *                suburb.
 *   BigDataCloud latitude/longitude -> city and state. Used for the
 *                "use my current location" button. It returns no postcode, so
 *                it fills the city and state and leaves the PIN to the shopper.
 *
 * Both are proxied rather than called from the browser so the results can be
 * cached — a PIN code's district does not change — and so an outage degrades to
 * "type it yourself" instead of a console error on the checkout page.
 */

const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map();

const getCached = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  return hit.value;
};

const setCached = (key, value) => {
  /* Bounded so a flood of distinct PINs cannot grow this without limit. */
  if (cache.size > 2000) cache.clear();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
};

/** Times out rather than leaving a checkout spinner hanging on a slow upstream. */
async function fetchJson(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'sukoon-store' },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PIN -> { city, state, localities[] }.
 * India Post returns one entry per post office in the PIN; they share a
 * district and state, so the first is enough for city/state and the names are
 * offered as a locality hint.
 */
export async function lookupPincode(pin) {
  const code = String(pin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'A PIN code is six digits.' };

  const key = `pin:${code}`;
  const cached = getCached(key);
  if (cached) return cached;

  let data;
  try {
    data = await fetchJson(`https://api.postalpincode.in/pincode/${code}`);
  } catch {
    return { ok: false, error: 'Could not look that up just now.' };
  }

  const entry = Array.isArray(data) ? data[0] : null;
  const offices = entry?.PostOffice || [];
  if (entry?.Status !== 'Success' || !offices.length) {
    return { ok: false, error: 'That PIN code was not found.' };
  }

  const result = {
    ok: true,
    pincode: code,
    city: offices[0].District || '',
    state: offices[0].State || '',
    localities: [...new Set(offices.map((o) => o.Name).filter(Boolean))].slice(0, 12),
  };
  setCached(key, result);
  return result;
}

/** Latitude/longitude -> { city, state }. Rounded to ~1km for a usable cache key. */
export async function reverseGeocode(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    return { ok: false, error: 'Those coordinates are not valid.' };
  }

  const key = `geo:${la.toFixed(2)},${lo.toFixed(2)}`;
  const cached = getCached(key);
  if (cached) return cached;

  let d;
  try {
    d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`
    );
  } catch {
    return { ok: false, error: 'Could not find your location just now.' };
  }

  const result = {
    ok: true,
    city: d.city || d.locality || '',
    state: d.principalSubdivision || '',
    country: d.countryName || '',
    /* The service rarely returns one for India, so this is usually blank and
       the shopper still types their PIN. */
    pincode: d.postcode || '',
  };
  setCached(key, result);
  return result;
}
