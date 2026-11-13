/* Two independent sessions can be live at once — a shop owner testing her own
   storefront is signed in as both. They are stored under separate keys and the
   server scopes each token to its audience, so neither can stand in for the other. */
import {
  DEFAULT_PRODUCTS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_SLIDES,
  DEFAULT_BANNERS,
} from './catalogDefaults.js';

const TOKEN_KEY = 'sukoon_admin_token';
const CUSTOMER_TOKEN_KEY = 'sukoon_customer_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export const getCustomerToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (t) =>
  (t ? localStorage.setItem(CUSTOMER_TOKEN_KEY, t) : localStorage.removeItem(CUSTOMER_TOKEN_KEY));

/* -------------------------------------------------------- client-side cache */
const CACHE_PREFIX = 'sukoon_store_cache_v3:';

function getLocalCache(key, fallback = null) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data !== undefined) return parsed.data;
    return fallback;
  } catch {
    return fallback;
  }
}

function setLocalCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export function invalidateCatalogCache(key) {
  try {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key);
    } else {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
}

/* ---------------------------------------------------- wake-up coordinator */
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
let wakeUpPromise = null;

/**
 * Single-flight probe coordinator: when Render is hibernating on its free tier,
 * only ONE health check probe polls the server with polite backoff. All concurrent
 * and queued requests wait on this same promise instead of blasting Render with
 * parallel requests that trigger 429 hibernate-rate-limited bursts.
 */
function waitForBackendWakeUp() {
  if (wakeUpPromise) return wakeUpPromise;

  wakeUpPromise = (async () => {
    // 5 attempts covering ~38s total (Render cold-start is ~30-40s)
    const intervals = [2500, 4500, 7000, 10000, 14000];
    for (const wait of intervals) {
      await new Promise((r) => setTimeout(r, wait));
      try {
        const probe = await fetch('/api/health', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (probe.ok) {
          wakeUpPromise = null;
          return true;
        }
      } catch {}
    }
    wakeUpPromise = null;
    return false;
  })();

  return wakeUpPromise;
}

/* ----------------------------------------------------------------- request */
async function request(path, { method = 'GET', body, auth = false, fallback = undefined } = {}) {
  const as = auth === true ? 'admin' : auth || null;
  const headers = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (as) {
    const token = as === 'customer' ? getCustomerToken() : getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = async () =>
    fetch(`/api${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

  let res = null;
  try {
    res = await doFetch();
  } catch {
    res = null;
  }

  // If upstream hit 429 (hibernate-rate-limited) or connection error:
  if (!res || TRANSIENT_STATUS.has(res.status)) {
    // If a fallback is provided and it's a GET, return fallback immediately
    // and let wake-up finish in the background
    if (fallback !== undefined && method === 'GET') {
      waitForBackendWakeUp().then((woke) => {
        if (woke) doFetch().catch(() => {});
      });
      return fallback;
    }

    // Otherwise (critical query, checkout, or login), wait for backend to finish cold-start:
    const woke = await waitForBackendWakeUp();
    if (woke) {
      try {
        res = await doFetch();
      } catch {
        res = null;
      }
    }
  }

  if (!res) {
    if (fallback !== undefined) return fallback;
    throw new Error('Connecting to store... Please retry in a few moments.');
  }

  if (res.status === 401 && as) {
    if (as === 'customer') {
      setCustomerToken(null);
    } else {
      setToken(null);
      if (location.pathname.includes('admin')) location.href = '/admin/login';
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (fallback !== undefined) return fallback;
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

/** Stale-While-Revalidate helper for public read-only storefront queries. */
async function cachedGet(key, path, defaultFallback) {
  const cached = getLocalCache(key, defaultFallback);

  // Background revalidation
  request(path, { method: 'GET', fallback: cached })
    .then((fresh) => {
      if (fresh && (Array.isArray(fresh) ? fresh.length > 0 : Object.keys(fresh).length > 0)) {
        setLocalCache(key, fresh);
      }
    })
    .catch(() => {});

  // Instant render from local cache / default bundle:
  return cached;
}

const qs = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

/* ------------------------------------------------- catalogue filtering helper */
const categoriesOf = (p) => (
  Array.isArray(p.categories) && p.categories.length
    ? p.categories
    : [p.category].filter(Boolean)
);

const positionOf = (p) => (Number.isFinite(Number(p.position)) ? Number(p.position) : Number.MAX_SAFE_INTEGER);

const byShopOrder = (a, b) =>
  positionOf(a) - positionOf(b)
  || (Number(b.sold) || 0) - (Number(a.sold) || 0)
  || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

function filterProductList(allProducts, params = {}) {
  const { category, q, zodiac, sort, featured, min, max, all } = params;
  let list = allProducts.filter((p) => (all === '1' ? true : p.active !== false));
  if (category && category !== 'all') list = list.filter((p) => categoriesOf(p).includes(category));
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
    newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    popular: (a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0),
    featured: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0),
  };
  list.sort(sorters[sort] || byShopOrder);
  return list;
}

/* -------------------------------------------------------------------- API */
export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me', { auth: true }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', { method: 'POST', body: { currentPassword, newPassword }, auth: true }),

  settings: () => cachedGet('settings', '/settings', DEFAULT_SETTINGS),

  /* Title, description and structured data for one URL, from the same builder
     the Cloudflare Worker uses -- see server/seo.js. */
  seoPage: (path) => request(`/seo/page${qs({ path })}`),
  saveSettings: async (patch) => {
    const res = await request('/settings', { method: 'PUT', body: patch, auth: true });
    invalidateCatalogCache('settings');
    return res;
  },

  categories: () => cachedGet('categories', '/categories', DEFAULT_CATEGORIES),

  products: (params) => {
    if (params?.all === '1' || params?.all === 1) {
      return request(`/products${qs(params)}`, { auth: true });
    }
    const all = getLocalCache('products', DEFAULT_PRODUCTS);
    // Background revalidate full products catalog
    request('/products', { method: 'GET', fallback: all })
      .then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          setLocalCache('products', fresh);
        }
      })
      .catch(() => {});
    return Promise.resolve(filterProductList(all, params));
  },

  product: (key) => {
    const all = getLocalCache('products', DEFAULT_PRODUCTS);
    const found = all.find((p) => p.slug === key || p.id === key);
    // Background revalidate
    const bg = request(`/products/${key}`, { fallback: found });
    if (found) {
      bg.catch(() => {});
      return Promise.resolve(found);
    }
    return bg;
  },

  createProduct: async (body) => {
    const res = await request('/products', { method: 'POST', body, auth: true });
    invalidateCatalogCache('products');
    return res;
  },
  updateProduct: async (id, body) => {
    const res = await request(`/products/${id}`, { method: 'PUT', body, auth: true });
    invalidateCatalogCache('products');
    return res;
  },
  reorderProducts: async (ids) => {
    const res = await request('/products/reorder', { method: 'PUT', body: { ids }, auth: true });
    invalidateCatalogCache('products');
    return res;
  },
  deleteProduct: async (id) => {
    const res = await request(`/products/${id}`, { method: 'DELETE', auth: true });
    invalidateCatalogCache('products');
    return res;
  },

  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/upload', { method: 'POST', body: fd, auth: true });
  },

  orders: (params) => request(`/orders${qs(params)}`, { auth: true }),
  placeOrder: (body) => request('/orders', { method: 'POST', body }),
  updateOrder: (id, body) => request(`/orders/${id}`, { method: 'PUT', body, auth: true }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE', auth: true }),
  track: (number) => request(`/orders/track/${encodeURIComponent(number)}`),

  paymentConfig: () =>
    cachedGet('payment_config', '/payments/config', {
      razorpay: true,
      keyId: 'rzp_live_Tdo40CAxtrRUs7',
      codAdvance: 200,
      codMinOrder: 500,
    }),
  createPayment: (body) => request('/payments/razorpay/order', { method: 'POST', body }),
  verifyPayment: (body) => request('/payments/razorpay/verify', { method: 'POST', body }),
  syncPayments: (hours = 168) => request('/payments/reconcile', { method: 'POST', body: { hours }, auth: true }),

  banners: (all) =>
    all ? request('/banners?all=1', { auth: true }) : cachedGet('banners', '/banners', DEFAULT_BANNERS),
  createBanner: async (body) => {
    const res = await request('/banners', { method: 'POST', body, auth: true });
    invalidateCatalogCache('banners');
    return res;
  },
  updateBanner: async (id, body) => {
    const res = await request(`/banners/${id}`, { method: 'PUT', body, auth: true });
    invalidateCatalogCache('banners');
    return res;
  },
  deleteBanner: async (id) => {
    const res = await request(`/banners/${id}`, { method: 'DELETE', auth: true });
    invalidateCatalogCache('banners');
    return res;
  },

  events: (all) => request(`/events${all ? '?all=1' : ''}`),
  createEvent: (body) => request('/events', { method: 'POST', body, auth: true }),
  updateEvent: (id, body) => request(`/events/${id}`, { method: 'PUT', body, auth: true }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE', auth: true }),

  services: () => request('/services'),
  allServices: () => request('/services/all', { auth: true }),
  createService: (body) => request('/services', { method: 'POST', body, auth: true }),
  updateService: (id, body) => request(`/services/${id}`, { method: 'PUT', body, auth: true }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE', auth: true }),
  consultCalendar: () => request('/bookings/calendar'),
  availability: (date) => request(`/bookings/availability${qs({ date })}`),
  bookings: (params) => request(`/bookings${qs(params)}`, { auth: true }),
  book: (body) => request('/bookings', { method: 'POST', body }),
  updateBooking: (id, body) => request(`/bookings/${id}`, { method: 'PUT', body, auth: true }),
  deleteBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE', auth: true }),

  /* ---- customer account ---- */
  register: (body) => request('/account/register', { method: 'POST', body }),
  accountLogin: (email, password) => request('/account/login', { method: 'POST', body: { email, password } }),
  account: () => request('/account/me', { auth: 'customer' }),
  saveAccount: (body) => request('/account/me', { method: 'PUT', body, auth: 'customer' }),
  accountPassword: (currentPassword, newPassword) =>
    request('/account/password', { method: 'POST', body: { currentPassword, newPassword }, auth: 'customer' }),
  myOrders: () => request('/account/orders', { auth: 'customer' }),
  myReturns: () => request('/account/returns', { auth: 'customer' }),
  returnable: (orderId) => request(`/account/orders/${orderId}/returnable`, { auth: 'customer' }),
  requestReturn: (body) => request('/account/returns', { method: 'POST', body, auth: 'customer' }),

  /* ---- birth chart ---- */
  astroStatus: () => request('/astro/status'),
  cities: (q) => request(`/astro/cities?q=${encodeURIComponent(q)}`, { auth: 'customer' }),
  myChart: () => request('/account/birth-chart', { auth: 'customer' }),
  drawChart: (body) => request('/account/birth-chart', { method: 'POST', body, auth: 'customer' }),
  uploadReturnPhoto: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/account/uploads', { method: 'POST', body: fd, auth: 'customer' });
  },

  /* ---- returns (admin) ---- */
  returns: (status) => request(`/returns${qs({ status })}`, { auth: true }),
  updateReturn: (id, body) => request(`/returns/${id}`, { method: 'PUT', body, auth: true }),

  customers: () => request('/customers', { auth: true }),
  customersSummary: () => request('/customers/summary', { auth: true }),
  customerChart: (id) => request(`/customers/${id}/birth-chart`, { auth: true }),
  invoice: (orderId) => request(`/orders/${orderId}/invoice`, { auth: true }),

  pincode: (pin) => request(`/geo/pincode/${pin}`),
  reverseGeocode: (lat, lon) => request(`/geo/reverse${qs({ lat, lon })}`),

  checkCoupon: (body) => request('/coupons/check', { method: 'POST', body }),
  coupons: () => request('/coupons', { auth: true }),
  createCoupon: (body) => request('/coupons', { method: 'POST', body, auth: true }),
  updateCoupon: (id, body) => request(`/coupons/${id}`, { method: 'PUT', body, auth: true }),
  deleteCoupon: (id) => request(`/coupons/${id}`, { method: 'DELETE', auth: true }),

  pages: () => request('/pages'),
  page: (handle) => request(`/pages/${handle}`),
  savePage: (handle, body) => request(`/pages/${handle}`, { method: 'PUT', body, auth: true }),

  reviews: (params) => {
    const limit = params?.limit || 12;
    const key = `reviews_lim_${limit}`;
    return cachedGet(key, `/reviews${qs(params)}`, []);
  },

  uploadReviewVideo: (file, { admin = false } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/reviews/video', { method: 'POST', body: fd, auth: admin && 'admin' });
  },

  reviewVideos: () => request('/reviews/videos', { auth: true }),
  accountPerks: () => request('/account/perks', { auth: 'customer' }),

  createReview: async (body) => {
    const res = await request('/reviews/admin', { method: 'POST', body, auth: true });
    invalidateCatalogCache('reviews');
    return res;
  },
  allReviews: (status) => request(`/reviews/all${qs({ status })}`, { auth: true }),
  submitReview: (body) => request('/reviews', { method: 'POST', body }),
  updateReview: async (id, body) => {
    const res = await request(`/reviews/${id}`, { method: 'PUT', body, auth: true });
    invalidateCatalogCache('reviews');
    return res;
  },
  deleteReview: async (id) => {
    const res = await request(`/reviews/${id}`, { method: 'DELETE', auth: true });
    invalidateCatalogCache('reviews');
    return res;
  },

  slides: (all) =>
    all ? request('/slides?all=1', { auth: true }) : cachedGet('slides', '/slides', DEFAULT_SLIDES),
  createSlide: async (body) => {
    const res = await request('/slides', { method: 'POST', body, auth: true });
    invalidateCatalogCache('slides');
    return res;
  },
  updateSlide: async (id, body) => {
    const res = await request(`/slides/${id}`, { method: 'PUT', body, auth: true });
    invalidateCatalogCache('slides');
    return res;
  },
  deleteSlide: async (id) => {
    const res = await request(`/slides/${id}`, { method: 'DELETE', auth: true });
    invalidateCatalogCache('slides');
    return res;
  },

  analytics: (days) => request(`/analytics/summary${qs({ days })}`, { auth: true }),
  trackVisit: (body) => request('/analytics/visit', { method: 'POST', body }).catch(() => {}),
};

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export const compact = (n) =>
  n >= 10000000 ? `${(n / 10000000).toFixed(2)} Cr`
  : n >= 100000 ? `${(n / 100000).toFixed(2)} L`
  : n >= 1000 ? `${(n / 1000).toFixed(1)}k`
  : String(n ?? 0);

export const dateLabel = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('en-IN', opts);
