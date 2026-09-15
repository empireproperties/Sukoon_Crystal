/* Meta Pixel.
 *
 * Loaded from here rather than pasted into index.html, because the admin is
 * served from the same shell and a pixel there would count staff sessions as
 * ad traffic. Nothing loads until init() is called from the storefront.
 *
 * Page views are sent by hand on every route change: this is a single-page
 * app, so the stock snippet's one PageView would only ever see the landing
 * page. */

const PIXEL_ID = '808089701770806';
const CURRENCY = 'INR';

let started = false;

export function initPixel() {
  if (started || typeof window === 'undefined') return;
  /* Same rule as the visit tracker: scripted browsers are not audiences. */
  if (navigator.webdriver === true) return;
  started = true;

  /* Meta's base code, unminified. Queues calls until fbevents.js arrives. */
  if (!window.fbq) {
    const fbq = function (...args) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const el = document.createElement('script');
    el.async = true;
    el.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(el);
  }
  window.fbq('init', PIXEL_ID);

  /* Every wa.me and tel: link on the site, wherever it lives, without each
     component having to remember to report it. Capture phase so a link that
     stops propagation is still counted. */
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) track('Contact', { method: 'WhatsApp' });
    else if (href.startsWith('tel:')) track('Contact', { method: 'Phone' });
  }, true);
}

export function track(event, params, eventID) {
  if (!started || !window.fbq) return;
  window.fbq('track', event, params || {}, eventID ? { eventID: String(eventID) } : undefined);
}

export const pageView = () => track('PageView');

/* ------------------------------------------------------------ shop events */

const contents = (lines) => lines.map((l) => ({
  id: String(l.productId || l.slug),
  quantity: l.qty || 1,
  item_price: l.price,
}));

export const trackViewContent = (p) => track('ViewContent', {
  content_ids: [String(p.id)],
  content_name: p.name,
  content_type: 'product',
  value: p.price,
  currency: CURRENCY,
});

export const trackAddToCart = (p, qty = 1) => track('AddToCart', {
  content_ids: [String(p.id)],
  content_name: p.name,
  content_type: 'product',
  contents: [{ id: String(p.id), quantity: qty, item_price: p.price }],
  value: p.price * qty,
  currency: CURRENCY,
});

export const trackInitiateCheckout = (cart, value) => track('InitiateCheckout', {
  content_ids: cart.map((l) => String(l.productId)),
  contents: contents(cart),
  content_type: 'product',
  num_items: cart.reduce((t, l) => t + l.qty, 0),
  value,
  currency: CURRENCY,
});

/* The order number doubles as the event id, so if server-side events are
   added later Meta can drop the duplicate instead of counting the sale twice. */
export const trackPurchase = (order) => track('Purchase', {
  content_ids: (order.items || []).map((l) => String(l.productId || l.slug)),
  contents: contents(order.items || []),
  content_type: 'product',
  num_items: (order.items || []).reduce((t, l) => t + (l.qty || 1), 0),
  value: order.total,
  currency: CURRENCY,
}, order.number || order.id);

export const trackBooking = (service, booking) => track('Schedule', {
  content_name: service?.name,
  value: service?.price || 0,
  currency: CURRENCY,
}, booking?.id);
