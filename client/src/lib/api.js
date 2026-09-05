/* Two independent sessions can be live at once — a shop owner testing her own
   storefront is signed in as both. They are stored under separate keys and the
   server scopes each token to its audience, so neither can stand in for the other. */
const TOKEN_KEY = 'sukoon_admin_token';
const CUSTOMER_TOKEN_KEY = 'sukoon_customer_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export const getCustomerToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (t) =>
  (t ? localStorage.setItem(CUSTOMER_TOKEN_KEY, t) : localStorage.removeItem(CUSTOMER_TOKEN_KEY));

/* `auth` is false, 'admin', or 'customer'. Passing true still means admin so
   existing call sites keep working. */
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const as = auth === true ? 'admin' : auth || null;
  const headers = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (as) {
    const token = as === 'customer' ? getCustomerToken() : getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    /* fetch only rejects when the request never completed — the server is down,
       restarting, or the connection dropped. The browser's own wording for this
       is "Failed to fetch", which tells a shop owner nothing. */
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && as) {
    if (as === 'customer') {
      setCustomerToken(null);
      /* No hard redirect — the account pages render their own sign-in prompt,
         and a 401 on a background call should not yank the visitor off a page. */
    } else {
      setToken(null);
      if (location.pathname.includes('admin')) location.href = '/admin/login';
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const qs = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me', { auth: true }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', { method: 'POST', body: { currentPassword, newPassword }, auth: true }),

  settings: () => request('/settings'),
  saveSettings: (patch) => request('/settings', { method: 'PUT', body: patch, auth: true }),

  categories: () => request('/categories'),
  products: (params) => request(`/products${qs(params)}`),
  product: (key) => request(`/products/${key}`),
  createProduct: (body) => request('/products', { method: 'POST', body, auth: true }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body, auth: true }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE', auth: true }),

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

  paymentConfig: () => request('/payments/config'),
  createPayment: (body) => request('/payments/razorpay/order', { method: 'POST', body }),
  verifyPayment: (body) => request('/payments/razorpay/verify', { method: 'POST', body }),

  banners: (all) => request(`/banners${all ? '?all=1' : ''}`),
  createBanner: (body) => request('/banners', { method: 'POST', body, auth: true }),
  updateBanner: (id, body) => request(`/banners/${id}`, { method: 'PUT', body, auth: true }),
  deleteBanner: (id) => request(`/banners/${id}`, { method: 'DELETE', auth: true }),

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

  reviews: (params) => request(`/reviews${qs(params)}`),
  allReviews: (status) => request(`/reviews/all${qs({ status })}`, { auth: true }),
  submitReview: (body) => request('/reviews', { method: 'POST', body }),
  updateReview: (id, body) => request(`/reviews/${id}`, { method: 'PUT', body, auth: true }),
  deleteReview: (id) => request(`/reviews/${id}`, { method: 'DELETE', auth: true }),

  slides: (all) => request(`/slides${all ? '?all=1' : ''}`),
  createSlide: (body) => request('/slides', { method: 'POST', body, auth: true }),
  updateSlide: (id, body) => request(`/slides/${id}`, { method: 'PUT', body, auth: true }),
  deleteSlide: (id) => request(`/slides/${id}`, { method: 'DELETE', auth: true }),

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
