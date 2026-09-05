import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveNow, uid } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const { products: PRODUCTS, categories: CATEGORIES } = CATALOG;

/* Deterministic PRNG so every demo reset produces the same believable numbers. */
let s = 20260825;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DAY = 86400000;
const NOW = new Date('2026-08-25T10:30:00.000Z').getTime();
const iso = (t) => new Date(t).toISOString();

const FIRST = ['Aarav', 'Ananya', 'Ishita', 'Rohan', 'Meera', 'Kabir', 'Sanya', 'Vikram', 'Neha', 'Aditya', 'Priya', 'Rahul', 'Tanvi', 'Arjun', 'Shreya', 'Nikhil', 'Divya', 'Karan', 'Pooja', 'Siddharth', 'Riya', 'Manav', 'Kavya', 'Deepak'];
const LAST = ['Sharma', 'Khanna', 'Verma', 'Gupta', 'Mehta', 'Kapoor', 'Singh', 'Nair', 'Iyer', 'Bansal', 'Chopra', 'Malhotra', 'Joshi', 'Reddy', 'Agarwal', 'Sethi'];
const CITY = [
  ['Meerut', 'Uttar Pradesh', '250110'], ['Delhi', 'Delhi', '110001'], ['Gurugram', 'Haryana', '122001'],
  ['Mumbai', 'Maharashtra', '400001'], ['Bengaluru', 'Karnataka', '560001'], ['Pune', 'Maharashtra', '411001'],
  ['Jaipur', 'Rajasthan', '302001'], ['Lucknow', 'Uttar Pradesh', '226001'], ['Hyderabad', 'Telangana', '500001'],
  ['Chandigarh', 'Punjab', '160017'], ['Kolkata', 'West Bengal', '700001'], ['Ahmedabad', 'Gujarat', '380001'],
];
const SOURCES = ['Instagram', 'Google', 'Direct', 'WhatsApp', 'Facebook', 'Referral'];
const PATHS = ['/', '/shop', '/shop/wellness-bracelets', '/shop/zodiac-bracelets', '/shop/rudraksha', '/book', '/about', '/contact', '/cart'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet'];

/* ---------------- products ---------------- */
/* Real catalogue pulled from the live Shopify store, enriched with demo-only
   commerce fields (stock, ratings, sales history). */
const products = PRODUCTS.map((p, i) => ({
  id: uid('prd'),
  ...p,
  sku: `SKN-${String(i + 101).padStart(4, '0')}`,
  stock: int(4, 60),
  rating: +(4.3 + rnd() * 0.65).toFixed(1),
  reviews: int(14, 226),
  featured: i % 5 === 0,
  bestseller: /money magnet|triple protection|5 mukhi|stress relief|charging plate \(circle plain\)|love bond/i.test(p.name),
  active: true,
  sold: 0,
  createdAt: iso(NOW - int(30, 300) * DAY),
}));

/* ---------------- orders ---------------- */
const STATUS_FLOW = ['placed', 'confirmed', 'packed', 'in_transit', 'delivered'];
const orders = [];
for (let d = 89; d >= 0; d--) {
  const dayStart = NOW - d * DAY;
  const dow = new Date(dayStart).getDay();
  // gentle growth curve + weekend lift + festive spike in the last fortnight
  let count = Math.round(1.4 + (89 - d) * 0.045 + (dow === 0 || dow === 6 ? 1.6 : 0) + (d < 14 ? 1.8 : 0));
  count = Math.max(0, count + int(-1, 2));
  for (let n = 0; n < count; n++) {
    const created = dayStart + int(6, 22) * 3600000 + int(0, 59) * 60000;
    if (created > NOW) continue;
    const age = (NOW - created) / DAY;
    let status;
    if (rnd() < 0.055) status = 'cancelled';
    else if (age > 7) status = 'delivered';
    else if (age > 4) status = rnd() < 0.82 ? 'delivered' : 'in_transit';
    else if (age > 2) status = rnd() < 0.7 ? 'in_transit' : 'packed';
    else if (age > 1) status = rnd() < 0.6 ? 'packed' : 'confirmed';
    else status = rnd() < 0.5 ? 'confirmed' : 'placed';

    const items = [];
    const lines = rnd() < 0.62 ? 1 : rnd() < 0.85 ? 2 : 3;
    for (let l = 0; l < lines; l++) {
      const p = pick(products);
      if (items.some((it) => it.productId === p.id)) continue;
      const qty = rnd() < 0.82 ? 1 : 2;
      items.push({ productId: p.id, name: p.name, slug: p.slug, price: p.price, qty, image: p.images[0] });
    }
    const subtotal = items.reduce((t, it) => t + it.price * it.qty, 0);
    const shipping = subtotal >= 999 ? 0 : 60;
    const discount = rnd() < 0.28 ? Math.round(subtotal * 0.1) : 0;
    const [city, state, pin] = pick(CITY);
    const name = `${pick(FIRST)} ${pick(LAST)}`;

    const timeline = [];
    const idx = status === 'cancelled' ? 1 : STATUS_FLOW.indexOf(status);
    for (let k = 0; k <= idx; k++) {
      timeline.push({ status: STATUS_FLOW[k], at: iso(created + k * (int(14, 34) * 3600000)) });
    }
    if (status === 'cancelled') timeline.push({ status: 'cancelled', at: iso(created + int(4, 40) * 3600000) });

    orders.push({
      id: uid('ord'),
      number: `SKN${String(1000 + orders.length + 1)}`,
      createdAt: iso(created),
      status,
      customer: {
        name,
        email: `${name.split(' ')[0].toLowerCase()}${int(10, 99)}@gmail.com`,
        phone: `+91 9${int(10000000, 99999999)}`,
        address: `${int(1, 220)}, ${pick(['Shanti Nagar', 'Green Park', 'Model Town', 'Civil Lines', 'Sector 14', 'Rajendra Nagar'])}`,
        city, state, pincode: pin,
      },
      items,
      subtotal,
      shipping,
      discount,
      total: subtotal + shipping - discount,
      payment: rnd() < 0.42 ? 'COD' : 'Prepaid',
      courier: pick(['Delhivery', 'BlueDart', 'DTDC', 'India Post']),
      awb: `AWB${int(100000000, 999999999)}`,
      source: pick(SOURCES),
      timeline,
      notes: '',
    });
  }
}
orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
for (const o of orders) {
  if (o.status === 'cancelled') continue;
  for (const it of o.items) {
    const p = products.find((x) => x.id === it.productId);
    if (p) p.sold += it.qty;
  }
}

/* ---------------- visits ---------------- */
const visits = [];
for (let d = 89; d >= 0; d--) {
  const dayStart = NOW - d * DAY;
  const dow = new Date(dayStart).getDay();
  let count = Math.round(48 + (89 - d) * 1.35 + (dow === 0 || dow === 6 ? 34 : 0) + (d < 14 ? 55 : 0) + int(-14, 20));
  for (let n = 0; n < count; n++) {
    const at = dayStart + int(0, 23) * 3600000 + int(0, 59) * 60000;
    if (at > NOW) continue;
    visits.push({
      id: uid('vst'),
      at: iso(at),
      path: pick(PATHS),
      session: `s_${Math.floor(at / 1000)}_${int(1, 4)}`,
      source: pick(SOURCES),
      device: pick(DEVICES),
    });
  }
}

/* ---------------- events (celestial calendar + store events) ---------------- */
const E = (title, dateOffset, type, desc, extra = {}) => ({
  id: uid('evt'),
  title,
  date: iso(NOW + dateOffset * DAY).slice(0, 10),
  time: extra.time || '19:00',
  type,
  description: desc,
  location: extra.location || 'Online / Instagram Live',
  published: extra.published !== false,
  createdAt: iso(NOW - 10 * DAY),
  ...extra,
});
const events = [
  E('New Moon in Leo - Intention Setting', -4, 'celestial', 'A new lunar cycle in Leo. Write your intention, hold your citrine, and begin. Free guided audio on the day.'),
  E('Krishna Janmashtami Blessing Circle', -1, 'festival', 'A midnight circle of chanting and crystal charging. Join Swati live for the aarti and a group energising of your malas.'),
  E('Full Moon Charging Ritual', 3, 'celestial', 'The Pisces full moon - the single best night of the month to cleanse every crystal you own. Step-by-step ritual shared live at moonrise.', { time: '20:30' }),
  E('Live Q&A with Swati Khanna', 6, 'live', 'Bring your birth chart questions. Forty-five minutes, unfiltered, on Instagram Live. Questions can be dropped in advance.', { time: '18:30' }),
  E('Ganesh Chaturthi - Prosperity Offer', 12, 'festival', 'Ten days of Bappa. Citrine and pyrite pieces at a special blessing price, each energised at the Meerut studio.', { location: 'Store-wide' }),
  E('Mercury Retrograde Begins', 18, 'celestial', 'Three weeks of slowed communication. Blue lace agate and sodalite are your allies - a short survival guide goes out that morning.', { time: '07:00' }),
  E('Numerology Masterclass - Your Life Path', 24, 'workshop', 'A ninety-minute live workshop decoding your life path number and the crystals that support it. Limited to forty seats.', { time: '17:00', location: 'Zoom (link on booking)' }),
  E('Navratri Nine-Night Ritual Series', 39, 'festival', 'Nine nights, nine goddesses, nine stones. A short ritual each evening with a companion crystal for each night.', { location: 'Store-wide' }),
  E('Karwa Chauth Rose Quartz Special', 55, 'festival', 'Rose quartz and moonstone pairings for the fast - curated gift boxes with hand-written notes.', { location: 'Store-wide' }),
  E('Diwali Lakshmi Puja Muhurat', 68, 'festival', 'The most auspicious window of the year for wealth crystals. Muhurat timings, the full puja sequence, and our Lakshmi kit.', { time: '18:00', location: 'Store-wide' }),
];

/* ---------------- banners ---------------- */
const banners = [
  {
    id: uid('bnr'),
    title: 'Shravan Special',
    subtitle: 'Energised Rudraksha & Shiva stones',
    message: 'Flat 15% off all Rudraksha through the holy month',
    code: 'SHRAVAN15',
    cta: 'Shop Rudraksha',
    link: '/shop/rudraksha',
    palette: 'auto',
    placement: 'top',
    active: true,
    startDate: iso(NOW - 12 * DAY).slice(0, 10),
    endDate: iso(NOW + 16 * DAY).slice(0, 10),
    createdAt: iso(NOW - 12 * DAY),
  },
  {
    id: uid('bnr'),
    title: 'Ganesh Chaturthi',
    subtitle: 'Prosperity collection',
    message: 'Citrine & Pyrite at blessing prices - Bappa blessings on every order',
    code: 'BAPPA20',
    cta: 'View collection',
    link: '/shop/crystal-trees',
    palette: 'saffron',
    placement: 'hero',
    active: false,
    startDate: iso(NOW + 10 * DAY).slice(0, 10),
    endDate: iso(NOW + 22 * DAY).slice(0, 10),
    createdAt: iso(NOW - 3 * DAY),
  },
  {
    id: uid('bnr'),
    title: 'Diwali Muhurat Sale',
    subtitle: 'The wealth window',
    message: 'Up to 30% off Lakshmi kits, money trees and citrine',
    code: 'DIWALI30',
    cta: 'Shop the sale',
    link: '/shop',
    palette: 'indigo',
    placement: 'top',
    active: false,
    startDate: iso(NOW + 62 * DAY).slice(0, 10),
    endDate: iso(NOW + 74 * DAY).slice(0, 10),
    createdAt: iso(NOW - 2 * DAY),
  },
];

/* ---------------- bookings (schedule a call) ---------------- */
const CONCERNS = ['Career & business direction', 'Marriage & relationship', 'Health & wellbeing', 'Financial blocks', 'Which crystal suits me', 'Custom bracelet consultation', 'Numerology reading', 'Home & vastu energy'];
const SERVICES = [
  { id: 'discovery', name: 'Discovery Call', minutes: 15, price: 0 },
  { id: 'crystal', name: 'Crystal Guidance', minutes: 30, price: 999 },
  { id: 'astro', name: 'Astrology Reading', minutes: 45, price: 1999 },
  { id: 'numero', name: 'Numerology Deep Dive', minutes: 60, price: 2999 },
];
const bookings = [];
for (let i = 0; i < 34; i++) {
  const offset = int(-24, 14);
  const svc = pick(SERVICES);
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const past = offset < 0;
  bookings.push({
    id: uid('bkg'),
    name,
    email: `${name.split(' ')[0].toLowerCase()}${int(10, 99)}@gmail.com`,
    phone: `+91 9${int(10000000, 99999999)}`,
    date: iso(NOW + offset * DAY).slice(0, 10),
    slot: pick(['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00']),
    serviceId: svc.id,
    service: svc.name,
    minutes: svc.minutes,
    price: svc.price,
    mode: pick(['Video call', 'Phone call', 'Video call']),
    concern: pick(CONCERNS),
    birthDate: iso(NOW - int(6500, 16000) * DAY).slice(0, 10),
    birthTime: `${String(int(0, 23)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`,
    birthPlace: pick(CITY)[0],
    status: past ? (rnd() < 0.88 ? 'completed' : 'no_show') : rnd() < 0.75 ? 'confirmed' : 'pending',
    notes: '',
    createdAt: iso(NOW + (offset - int(2, 9)) * DAY),
  });
}
bookings.sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));

saveNow({
  products,
  categories: CATEGORIES,
  orders,
  banners,
  events,
  bookings,
  visits,
  services: SERVICES,
  settings: {
    design: 'atelier',
    palette: 'bone',
    siteName: 'Sukoon Crystal Solutions',
    tagline: 'Find your Sukoon',
    phone: '+91 90122 57555',
    email: 'sukoon.crystalsolutions@gmail.com',
    address: '1st Floor, A-97 Roorkee Road, Modi Puram, Meerut',
    instagram: 'https://instagram.com/sukoon.crystalsolutions',
    announcement: 'Free shipping across India on orders above Rs 999  -  Cash on delivery available',
    seededAt: iso(NOW),
  },
});

console.log(`Seeded: ${products.length} products, ${orders.length} orders, ${visits.length} visits, ${bookings.length} bookings, ${events.length} events, ${banners.length} banners.`);
