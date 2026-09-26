import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus, Plus, ShoppingBag, Truck, ShieldCheck, RotateCcw, Check, ChevronRight,
  ChevronDown, Phone, BadgeCheck, Sparkles, Tag, MapPin, Heart, Share2, Star, Play,
} from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { trackViewContent } from '../lib/pixel.js';
import ProductImage from '../components/ProductImage.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Stagger } from '../components/Motion.jsx';
import { ChakraDot, ZODIAC } from '../components/Ornaments.jsx';
import { SectionHead } from './home/shared.jsx';
import ProductReviews from '../components/ProductReviews.jsx';

const TABS = [
  { id: 'details', label: 'Description' },
  { id: 'ritual', label: 'How to wear it' },
  { id: 'care', label: 'Care & cleansing' },
  { id: 'shipping', label: 'Shipping & returns' },
];

const TAB_COPY = {
  ritual: [
    'Wear it on your left wrist to receive and on your right to project. If you are unsure, the left wrist is the safer place to start.',
    'Hold it for a minute each morning and state your intention in the same words each day. The repetition is the point, not the wording.',
    'Take it off in the shower and while sleeping for the first week, so you notice the difference it makes.',
    'If it feels heavy or restless in the first few days, that is normal. Give it a fortnight before deciding.',
  ],
  care: [
    'Rinse under running water for thirty seconds once a fortnight and pat dry. Never soak selenite, howlite or malachite.',
    'Rest the piece on a selenite plate overnight, or leave it on a windowsill under the full moon.',
    'Keep it away from perfume, chlorine and direct afternoon sun — the colour fades faster than the energy does.',
    'Restring every twelve to eighteen months with daily wear. We restring pieces bought from us at no charge.',
  ],
  shipping: [
    'Dispatched within 48 hours. Every piece is cleansed and charged before packing, never on the same day it is ordered.',
    'Free shipping across India on orders above ₹600. Cash on delivery is available on orders over ₹500.',
    'Delivery usually takes three to six working days depending on your PIN code.',
    'Seven-day replacement on breakage or defects. Energised pieces are personal, so we do not resell returns.',
  ],
};

const OFFERS = [
  { code: 'SUKOON10', text: '10% off your first order' },
  { code: null, text: 'Every piece is energised and blessing-sealed before dispatch' },
  { code: null, text: 'Free selenite charging plate on orders above ₹2,499' },
];

const FAQ = [
  { q: 'Is this stone genuine?', a: 'Yes. Every batch is checked by hand before stringing, and we never sell dyed glass under a stone name. If you would like a certificate for a higher-value piece, ask on the call.' },
  { q: 'Will it fit my wrist?', a: 'Bracelets are strung on a stretch cord at 18cm, which fits most adult wrists. Tell us on the order note if you need 16cm or 20cm and we will restring it before dispatch at no charge.' },
  { q: 'How is it energised?', a: 'Cleansed in Himalayan salt, left under moonlight overnight, then sealed with the Mahamrityunjaya mantra at the Meerut studio before packing.' },
  { q: 'Can I return it?', a: 'Seven-day replacement on breakage or defects. Because each piece is energised for the person who ordered it, we do not resell returns, so we would rather you called first if you are unsure.' },
];

/* --------------------------------------------------------- pincode check */
function DeliveryCheck() {
  const [pin, setPin] = useState('');
  const [result, setResult] = useState(null);

  const check = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setResult({ ok: false, text: 'Please enter a valid 6-digit PIN code.' });
    /* Demo estimate derived from the PIN so it stays consistent per code. */
    const days = 3 + (Number(pin[5]) % 4);
    const date = new Date(Date.now() + (days + 2) * 86400000);
    setResult({
      ok: true,
      text: `Delivers by ${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · Cash on delivery available`,
    });
  };

  return (
    <div className="border-t border-line pt-5">
      <p className="field-label flex items-center gap-2">
        <MapPin size={13} strokeWidth={1.8} className="text-accent" /> Check delivery to your area
      </p>
      <form onSubmit={check} className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setResult(null); }}
          placeholder="6-digit PIN code"
          inputMode="numeric"
          aria-label="PIN code"
          className="field tnum"
        />
        <button className="btn btn-outline shrink-0">Check</button>
      </form>
      <AnimatePresence>
        {result && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-2.5 flex items-center gap-1.5 text-[0.82rem] ${result.ok ? 'text-ok' : 'text-sale'}`}
          >
            {result.ok && <Check size={13} strokeWidth={2.4} />} {result.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- FAQ row */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
        <span className="text-[0.92rem] font-medium">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="pb-4 pr-8 text-[0.88rem] leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ page ══ */
export default function Product() {
  const { slug } = useParams();
  const { addToCart, remember, seen, toast } = useShop();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [tab, setTab] = useState('details');
  const [added, setAdded] = useState(false);
  const [wish, setWish] = useState(false);

  const { data: p, loading } = useAsync(() => api.product(slug), [slug]);

  useEffect(() => { setQty(1); setActiveImg(0); setAdded(false); setTab('details'); setWish(false); }, [slug]);
  useEffect(() => { if (p?.id) remember(p); }, [p, remember]);
  useEffect(() => { if (p?.id) trackViewContent(p); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The floating WhatsApp disc is fixed to the bottom-right of the viewport, so
     on a phone it was landing squarely on this page's sticky Add to cart and
     clipping the label. The bar publishes its own height as --bottom-bar and
     the disc lifts by exactly that much (see .fab-bottom in index.css).

     Measured rather than hardcoded because the bar grows when a long product
     name wraps, and a ResizeObserver reports 0 once `lg:hidden` takes the bar
     out of the layout -- which is precisely when the disc should drop back. */
  const buyBarRef = useRef(null);
  useEffect(() => {
    const el = buyBarRef.current;
    if (!el) return undefined;
    const root = document.documentElement;
    /* offsetHeight, not contentRect: the bar carries 12px of padding a side
       plus a top border, and the content box alone left the disc 25px short. */
    const publish = () => root.style.setProperty('--bottom-bar', `${el.offsetHeight}px`);
    const ro = new ResizeObserver(publish);
    publish();
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--bottom-bar'); };
  }, [p?.id]);

  const off = p && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const signs = useMemo(() => ZODIAC.filter((z) => (p?.zodiac || []).includes(z.id)), [p]);
  const images = p?.images?.length ? p.images : [null];

  /* The clip belongs in the gallery, after the photographs: it is another view
     of the same object, not a separate section further down the page. Photos
     keep their index, so `media[i]` and `p.images[i]` agree for every photo. */
  const videoSrc = p?.video ? (typeof p.video === 'string' ? p.video : p.video.url) : '';
  const media = [
    ...images.map((src) => ({ kind: 'photo', src })),
    ...(videoSrc ? [{ kind: 'video', src: videoSrc }] : []),
  ];

  /* The thumbnail rail runs down the left of the photo and finishes level with
     it: the thumbnails stretch to share the photo's height, so there is never
     a blank strip under them however many pictures a product has.
     That leaves only the rail's width to choose, and the width is what decides
     whether the thumbnails come out square. The gallery column is a fixed
     540px at lg, the rail sits 12px from the photo and the thumbnails are 10px
     apart, so n square thumbnails of side T satisfy
     n*T + 10*(n-1) = 540 - T - 12. Solving for T gives square thumbnails for
     three to six photos, which is what nearly every product has; outside that
     the clamp holds the rail to a sensible width and the crop goes slightly
     portrait or landscape instead. */
  const thumb = Math.round(Math.min(132, Math.max(64, (540 - 2 - 10 * media.length) / (media.length + 1))));
  const recentlyViewed = seen.filter((s) => s.slug !== slug).slice(0, 5);

  if (loading) {
    return (
      <div className="wrap py-10" style={{ '--wrap': '1120px' }}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:gap-12">
          <div className="skeleton aspect-[4/5] rounded-[var(--r-card)]" />
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-5 rounded" style={{ width: `${94 - i * 7}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="grid min-h-[55vh] place-items-center px-5 text-center">
        <div>
          <h1 className="h-sec">Product not found</h1>
          <p className="mt-2 text-[0.92rem] text-muted">It may have sold out, or the link may be out of date.</p>
          <Link to="/shop" className="btn btn-primary mt-6">Back to shop</Link>
        </div>
      </div>
    );
  }

  const add = () => {
    addToCart(p, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const specs = [
    ['Stones', p.stone],
    ['Chakra', p.chakra],
    ['Element', p.element],
    ['Bead size', '8 mm'],
    ['Wrist size', '18 cm stretch cord (restrung free on request)'],
    ['Finish', 'Hand-polished, hand-knotted'],
    ['Origin', 'Sourced in India and Nepal, finished in Meerut'],
    ['Energised', 'Salt cleanse, moonlight charge, mantra sealed'],
  ];

  return (
    <>
      {/* Narrower than the site-wide 1320px measure, set once so the
          breadcrumb and every section below the gallery share it. The gallery
          and the buy box together want about 1050px; give them 1320 and the
          leftover has to go somewhere, which is how a 300px hole opened up
          between the two columns. The margin sits outside the page instead. */}
      <div style={{ '--wrap': '1120px' }}>
      {/* ------------------------------------------------------ breadcrumb */}
      <div className="border-b border-line bg-bg2">
        <nav aria-label="Breadcrumb" className="wrap flex flex-wrap items-center gap-1.5 py-3 text-[0.78rem] text-muted [&_a]:-my-2 [&_a]:py-2">
          <Link to="/" className="hover:text-brand">Home</Link>
          <ChevronRight size={12} className="opacity-50" />
          {/* A product can belong to several collections; the breadcrumb
              names the first, which is the one it was filed under. */}
          <Link to={`/shop/${p.categories?.[0] || p.category}`} className="capitalize hover:text-brand">
            {(p.categories?.[0] || p.category || '').replace(/-/g, ' ')}
          </Link>
          <ChevronRight size={12} className="opacity-50" />
          <span className="line-clamp-1 text-ink">{p.name}</span>
        </nav>
      </div>

      <div className="wrap py-8 lg:py-10">
        {/* A fixed 540px gallery and a buy box that takes whatever is left of
            the 1120px measure. Both tracks are bounded and neither can grow,
            so there is no leftover width to open a gap between them. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:gap-12">
          {/* ══════════════════════════════════════════════════ GALLERY */}
          {/* `min-w-0`: a grid item will not shrink below its content unless
              told to, and this column was holding the page 7px wider than a
              320px screen. */}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-col-reverse gap-3 lg:flex-row" style={{ '--thumb': `${thumb}px` }}>
              {media.length > 1 && (
                <div
                  /* Below lg this is a horizontal scroller under the photo:
                     `w-full min-w-0` so it is a scroll container rather than a
                     row that grows to fit its thumbnails and drags the whole
                     layout wider than a 320px screen. At lg it becomes the
                     side rail, its width set by the thumbnail size worked out
                     above, and it stretches to the photo's height — so more
                     photos than fit simply scroll instead of running past the
                     bottom of the picture. */
                  className="no-scrollbar flex w-full min-w-0 gap-2.5 overflow-x-auto lg:w-[var(--thumb)] lg:shrink-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
                >
                  {media.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      /* Hovering is enough — the same read-before-you-click
                         behaviour the product cards now have. The clip is the
                         exception: hovering swaps to it, but nothing plays
                         until the visitor presses play in the main frame. */
                      onMouseEnter={() => setActiveImg(i)}
                      className={`shrink-0 overflow-hidden border-2 transition-colors lg:w-full lg:flex-1 lg:basis-0 lg:min-h-[48px] ${
                        activeImg === i ? 'border-brand' : 'border-line hover:border-muted'
                      }`}
                      style={{ borderRadius: 'var(--r-card)' }}
                      aria-label={m.kind === 'video' ? 'Watch the video' : `View image ${i + 1} of ${images.length}`}
                    >
                      {/* `h-full` at lg: the button's height comes from the
                          rail, and the picture fills whatever it is given. The
                          `min-h` above is what makes a nine-photo rail scroll
                          rather than squash. */}
                      {m.kind === 'video' ? (
                        <span className="relative block h-16 w-16 lg:h-full lg:w-full">
                          {/* `preload="metadata"` is the first frame and a few
                              kilobytes, not the clip. */}
                          <video
                            src={m.src}
                            muted
                            playsInline
                            preload="metadata"
                            tabIndex={-1}
                            aria-hidden="true"
                            className="h-full w-full bg-black object-cover"
                          />
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink">
                              <Play size={12} className="ml-0.5 fill-current" />
                            </span>
                          </span>
                        </span>
                      ) : (
                        <ProductImage
                          product={p}
                          index={i}
                          className="h-16 w-16 lg:h-full lg:w-full"
                          sizes="140px"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative min-w-0 flex-1 overflow-hidden rounded-[var(--r-card)] border border-line bg-surface">
                <AnimatePresence mode="wait">
                  <motion.div key={activeImg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {/* Square. The photos are shot 4:5, but a 4:5 frame here
                        is a 500px-tall picture that pushes the price off a
                        laptop screen; the crop costs less than that does. It
                        matches the product cards, so the shape does not change
                        between the grid and this page. */}
                    {media[activeImg]?.kind === 'video' ? (
                      <video
                        src={media[activeImg].src}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-square w-full bg-black object-contain"
                      />
                    ) : (
                      <ProductImage product={p} index={activeImg} className="aspect-square" priority sizes="(max-width: 1024px) 100vw, 400px" />
                    )}
                  </motion.div>
                </AnimatePresence>
                {media.length > 1 && (
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-surface/85 px-2.5 py-1 text-[0.68rem] text-muted backdrop-blur-sm tnum">
                    {activeImg + 1} / {media.length}
                  </span>
                )}
                <div className="absolute right-3 top-3 flex flex-col gap-2">
                  <button
                    onClick={() => { setWish((w) => !w); toast(wish ? 'Removed from wishlist' : 'Saved to wishlist', 'success'); }}
                    className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-brand"
                    aria-label="Save to wishlist"
                  >
                    <Heart size={15} strokeWidth={1.7} className={wish ? 'fill-sale text-sale' : ''} />
                  </button>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(window.location.href); toast('Link copied', 'success'); }}
                    className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-brand"
                    aria-label="Copy link"
                  >
                    <Share2 size={15} strokeWidth={1.7} />
                  </button>
                </div>
              </div>
            </div>

            {/* Said before the money changes hands, not discovered afterwards
                in a policy page. The returns route refuses these outright. */}
            {p.returnable === false && (
              <p className="mt-3 rounded-[var(--r-btn)] border border-line bg-bg2 px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-muted">
                <strong className="text-ink">No return or exchange on this item.</strong>{' '}
                It is consumable and meant to be lit, so it cannot come back once it has left us.
              </p>
            )}

            {/* assurance row */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[
                { icon: BadgeCheck, label: 'Genuine stone' },
                { icon: Sparkles, label: 'Energised' },
                { icon: Truck, label: 'Ships in 48h' },
                { icon: RotateCcw, label: '7-day replacement' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-[var(--r-card)] border border-line bg-surface px-3 py-2.5">
                  <Icon size={15} strokeWidth={1.6} className="shrink-0 text-accent" />
                  <span className="text-[0.75rem] leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════ BUY BOX */}
          <div>
            <div className="lg:sticky lg:top-24">
              <p className="text-[0.8rem] text-muted">{p.stone}</p>
              <h1 className="mt-1.5 text-[1.6rem] leading-snug sm:text-[2rem]">{p.name}</h1>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-line py-3.5">
                <span className="text-[1.9rem] font-medium tnum">{inr(p.price)}</span>
                {off > 0 && (
                  <>
                    <span className="text-[1.05rem] text-muted line-through tnum">{inr(p.mrp)}</span>
                    <span className="badge badge-sale">{off}% off · save {inr(p.mrp - p.price)}</span>
                  </>
                )}
                {p.bogo && <span className="badge badge-sale">Launch offer · Buy 1 get 1 free</span>}
                <span className="w-full text-[0.76rem] text-muted">
                  Inclusive of all taxes
                  {p.bogo && ' · Add two to the basket and the second one is free.'}
                </span>
              </div>

              {/* offers */}
              <ul className="mt-3.5 space-y-1.5">
                {OFFERS.map((o) => (
                  <li key={o.text} className="flex items-start gap-2.5 text-[0.83rem]">
                    <Tag size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
                    <span className="text-muted">
                      {o.text}
                      {o.code && <> with code <strong className="text-ink">{o.code}</strong></>}
                    </span>
                  </li>
                ))}
              </ul>

              {/* stock */}
              <p className="mt-3.5 text-[0.86rem]">
                {p.stock === 0 ? <span className="text-sale">Out of stock — check back soon</span>
                : p.stock <= 5 ? <span className="text-sale">Only {p.stock} left in the studio</span>
                : <span className="inline-flex items-center gap-1.5 text-ok"><Check size={13} strokeWidth={2.6} /> In stock, dispatched within 48 hours</span>}
              </p>

              {/* qty + buy */}
              {/* Wraps on a 320px screen. The stepper is a fixed 124px and
                  "Add to cart" needs about 160 more, which does not fit beside
                  it — so below that the button takes its own full-width line
                  rather than dragging the whole column past the screen edge. */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center rounded-[var(--r-btn)] border border-line">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center text-muted hover:text-ink" aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span className="w-9 text-center text-[0.95rem] tnum">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(p.stock || 10, q + 1))} className="grid h-11 w-11 place-items-center text-muted hover:text-ink" aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
                <button onClick={add} disabled={p.stock === 0} className="btn btn-primary btn-lg min-w-[10rem] flex-1">
                  {added ? <><Check size={15} strokeWidth={2.4} /> Added to cart</> : <><ShoppingBag size={15} strokeWidth={1.7} /> Add to cart</>}
                </button>
              </div>
              <Link
                to="/checkout"
                onClick={() => p.stock > 0 && addToCart(p, qty)}
                className={`btn btn-accent btn-lg mt-2.5 w-full ${p.stock === 0 ? 'pointer-events-none opacity-40' : ''}`}
              >
                Buy it now
              </Link>

              <DeliveryCheck />

              {/* delivery promises */}
              <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-[0.84rem] text-muted">
                <li className="flex gap-2.5"><Truck size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" /> Free shipping above ₹600 · Cash on delivery available</li>
                <li className="flex gap-2.5"><ShieldCheck size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" /> Cleansed in salt and charged with mantra before dispatch</li>
                <li className="flex gap-2.5"><RotateCcw size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" /> Seven-day replacement on breakage or defects</li>
              </ul>

              {/* attributes */}
              <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3.5 border-t border-line pt-5 text-[0.85rem]">
                <div>
                  <dt className="text-[0.74rem] text-muted">Chakra</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5"><ChakraDot name={p.chakra} /> {p.chakra}</dd>
                </div>
                <div>
                  <dt className="text-[0.74rem] text-muted">Element</dt>
                  <dd className="mt-0.5">{p.element}</dd>
                </div>
                <div>
                  <dt className="text-[0.74rem] text-muted">SKU</dt>
                  <dd className="mt-0.5 tnum">{p.sku}</dd>
                </div>
                {signs.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-[0.74rem] text-muted">Suited to</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {signs.map((z) => (
                        <Link key={z.id} to={`/shop?zodiac=${z.id}`} className="badge badge-neutral hover:border-brand hover:text-brand">
                          <span className="text-accent">{z.glyph}</span> {z.name}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              {/* consult nudge */}
              <Link to="/book" className="mt-5 flex items-center gap-3.5 rounded-[var(--r-card)] border border-line bg-bg2 p-4 transition-colors hover:border-brand">
                <Phone size={17} strokeWidth={1.6} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.86rem] font-medium">Not sure this is the right stone?</span>
                  <span className="block text-[0.79rem] text-muted">Book a call with Swati before you buy.</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" />
              </Link>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ TABS */}
        <section className="mt-14 border-t border-line pt-8">
          {/* Chips that wrap on a phone, underlined tabs from `sm` up. These
              four labels need 529px and a phone gives the strip 350px, so as a
              scroller it hid "Care & cleansing" and "Shipping & returns" off
              the right edge -- on a product page that is exactly the copy a
              buyer is looking for before they commit.

              One strip rather than two, restyled at the breakpoint, because a
              second copy would duplicate the `layoutId` below and framer-motion
              would animate the underline between the hidden and visible ones. */}
          <div className="no-scrollbar flex flex-wrap gap-1.5 pb-3 sm:flex-nowrap sm:gap-1 sm:overflow-x-auto sm:border-b sm:border-line sm:pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-selected={tab === t.id}
                /* `shrink-0` keeps the `sm` strip a scroller rather than a
                   pile-up: a flex child shrinks below its own label by default,
                   so the tabs would otherwise overlap on a narrow tablet. */
                className={`relative shrink-0 whitespace-nowrap rounded-[var(--r-btn)] border px-3 py-2 text-[0.82rem] font-medium transition-colors sm:rounded-none sm:border-0 sm:px-4 sm:py-3 sm:text-[0.87rem] ${
                  tab === t.id
                    ? 'border-brand bg-brand text-onbrand sm:bg-transparent sm:text-brand'
                    : 'border-line text-muted hover:border-brand hover:text-brand sm:hover:text-ink'
                }`}
              >
                {t.label}
                {/* The sliding underline belongs to the tab rendering only. On
                    the wrapped chips there is no shared baseline to slide along,
                    and the active chip is already marked by its fill. */}
                {tab === t.id && (
                  <motion.span layoutId="pdp-tab" className="absolute inset-x-0 -bottom-px hidden h-0.5 bg-brand sm:block" />
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="max-w-2xl">
                {tab === 'details' ? (
                  <>
                    <p className="text-[0.96rem] leading-relaxed text-muted">{p.description}</p>
                    {(p.benefits || []).length > 0 && (
                      <>
                        <h3 className="mt-7 text-[1.05rem]">What it helps with</h3>
                        <ul className="mt-3.5 space-y-2.5">
                          {p.benefits.map((b) => (
                            <li key={b} className="flex gap-2.5 text-[0.9rem] leading-relaxed text-muted">
                              <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-ok" /> {b}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {(p.stones || []).length > 0 && (
                      <>
                        <h3 className="mt-7 text-[1.05rem]">Stones in this piece</h3>
                        <div className="mt-3.5 flex flex-wrap gap-2">
                          {p.stones.map((s) => <span key={s} className="badge badge-neutral">{s}</span>)}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <ul className="space-y-3.5">
                    {/* The shipping copy ends on a seven-day replacement
                        promise, which is the published policy and wrong for a
                        consumable. A page that offers a return in one panel
                        and refuses it in another is worse than either. */}
                    {(tab === 'shipping' && p.returnable === false
                      ? [
                        ...TAB_COPY.shipping.slice(0, -1),
                        'No return or exchange on this item. It is consumable and meant to be lit, so it cannot come back once it has left us.',
                      ]
                      : TAB_COPY[tab]
                    ).map((line, i) => (
                      <li key={i} className="flex gap-3 text-[0.9rem] leading-relaxed text-muted">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" /> {line}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>

            {/* specification table */}
            <aside>
              <h3 className="text-[1.05rem]">Specification</h3>
              <dl className="mt-4 divide-y divide-line rounded-[var(--r-card)] border border-line bg-surface">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex gap-4 px-4 py-3 text-[0.84rem]">
                    <dt className="w-28 shrink-0 text-muted">{k}</dt>
                    <dd className="min-w-0 flex-1">{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <ProductReviews product={p} />

        {/* ═══════════════════════════════════════════════════════ FAQ */}
        <section className="mt-12 border-t border-line pt-10">
          <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
            <SectionHead eyebrow="Questions" title="Before you buy" />
            <div>
              {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
              <p className="mt-5 text-[0.86rem] text-muted">
                Still unsure? <Link to="/book" className="text-brand link-underline">Book a call</Link> or{' '}
                <Link to="/contact" className="text-brand link-underline">send us a message</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════ RELATED */}
        {(p.related || []).length > 0 && (
          <section className="mt-14 border-t border-line pt-10">
            <SectionHead eyebrow="You may also like" title="Pairs well with this" />
            <Stagger className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {p.related.map((r) => <ProductCard key={r.id} product={r} />)}
            </Stagger>
          </section>
        )}

        {/* ══════════════════════════════════════════ RECENTLY VIEWED */}
        {recentlyViewed.length > 0 && (
          <section className="mt-14 border-t border-line pt-10">
            <h2 className="text-[1.2rem]">Recently viewed</h2>
            <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">
              {recentlyViewed.map((s) => (
                <Link key={s.id} to={`/product/${s.slug}`} className="group w-[150px] shrink-0">
                  <div className="overflow-hidden rounded-[var(--r-card)] bg-bg2">
                    <ProductImage product={{ name: s.name, image: s.image }} className="aspect-square" zoom sizes="150px" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[0.82rem] leading-snug">{s.name}</p>
                  <p className="text-[0.82rem] font-medium tnum">{inr(s.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      </div>

      {/* ══════════════════════════════════════ STICKY MOBILE BUY BAR */}
      <div ref={buyBarRef} className="sticky bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] font-medium">{p.name}</p>
            <p className="text-[0.9rem] font-semibold tnum">{inr(p.price)}</p>
          </div>
          <button onClick={add} disabled={p.stock === 0} className="btn btn-primary shrink-0">
            {added ? <><Check size={14} strokeWidth={2.4} /> Added</> : 'Add to cart'}
          </button>
        </div>
      </div>
    </>
  );
}
