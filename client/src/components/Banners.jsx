import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Tag, ArrowRight, Copy, Check } from 'lucide-react';

import { useShop } from '../lib/store.jsx';


/** Campaign palettes the admin picks from. Kept deliberately restrained. */
export const BANNER_PALETTES = {
  /* `auto` follows whichever storefront palette is live, so an announcement
     never fights the design it sits above. */
  auto: { bg: 'var(--c-brand-soft)', fg: 'var(--c-ink)', accent: 'var(--c-accent)', label: 'Match the theme' },
  /* The logo's own disc and foil, so a campaign banner sits in the brand
     rather than beside it. */
  green: { bg: '#0f3126', fg: '#f7f2e6', accent: '#d9ae59', label: 'Deep Green' },
  maroon: { bg: '#7a1f2b', fg: '#fff4f0', accent: '#e0a071', label: 'Maroon' },
  charcoal: { bg: '#232323', fg: '#f7f4ee', accent: '#c9a45f', label: 'Charcoal' },
  ink: { bg: '#2a231c', fg: '#fcfaf6', accent: '#c9a24a', label: 'Espresso & Gold' },
  saffron: { bg: '#9a4a12', fg: '#fff5e8', accent: '#f2c184', label: 'Festive Saffron' },
  indigo: { bg: '#2c3566', fg: '#f1f3ff', accent: '#a6b1ea', label: 'Indigo' },
};

const paletteOf = (id) => BANNER_PALETTES[id] || BANNER_PALETTES.auto;

/* ------------------------------------------------ thin announcement strip */

/* Shown when the admin has published no top-placement banners. These are the
   three lines Sukoon asked to rotate; they live here rather than in the
   database so the strip is never empty on a fresh install. Publishing any top
   banner in the admin replaces this set entirely. */
const DEFAULT_TICKER = [
  { id: 'tk-custom', message: 'For customisation of bracelets, connect with us on +91 90122 57555', link: '/contact', cta: 'Talk to us' },
  { id: 'tk-first', message: 'Enjoy 10% off your first order', code: 'SUKOON10', link: '/shop', cta: 'Shop now' },
  { id: 'tk-cod', message: 'Cash on delivery available on orders above ₹500, after a ₹200 prepaid advance', link: '/shipping-policy', cta: 'How it works' },
];

const TICKER_MS = 5000;

export function TopBanner() {
  const { banners, settings } = useShop();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('sukoon_banner_dismissed') === '1'
  );
  const [copied, setCopied] = useState(false);
  const [i, setI] = useState(0);

  const published = banners.filter((b) => b.placement === 'top' && b.message);
  const custom = settings?.announcement ? [{ id: 'settings', message: settings.announcement }] : [];
  const items = published.length ? published : (custom.length ? custom : DEFAULT_TICKER);

  /* Rotate. Paused while the tab is hidden so a backgrounded page does not
     churn, and skipped entirely when there is only one thing to say. */
  useEffect(() => {
    if (items.length < 2 || dismissed) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), TICKER_MS);
    return () => clearInterval(t);
  }, [items.length, dismissed]);

  useEffect(() => { setI((n) => (n >= items.length ? 0 : n)); }, [items.length]);

  if (!items.length || dismissed) return null;

  const b = items[i] || items[0];
  const p = paletteOf(b.palette);

  return (
    <div className="relative border-b border-line" style={{ background: p.bg, color: p.fg }}>
      <div className="wrap relative flex min-h-[36px] items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32 }}
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[0.78rem]"
          >
            {b.title && <span className="hidden font-medium sm:inline">{b.title}</span>}
            {b.title && <span className="hidden opacity-40 sm:inline">·</span>}
            <span className="opacity-95">{b.message}</span>
            {b.code && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(b.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] border px-2 py-0.5 text-[0.72rem] font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: `${p.accent}80`, color: p.accent }}
              >
                {copied ? <Check size={11} strokeWidth={2.4} /> : <Copy size={11} strokeWidth={2} />}
                {b.code}
              </button>
            )}
            {b.link && (
              <Link to={b.link} className="hidden items-center gap-1 underline underline-offset-4 md:inline-flex">
                {b.cta || 'Shop now'} <ArrowRight size={12} />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Progress pips double as manual controls. */}
        {items.length > 1 && (
          <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 gap-1 sm:flex">
            {items.map((it, n) => (
              <button
                key={it.id}
                onClick={() => setI(n)}
                aria-label={`Announcement ${n + 1}`}
                aria-current={n === i}
                className="h-1 rounded-full transition-all"
                style={{ width: n === i ? 14 : 5, background: p.fg, opacity: n === i ? 0.85 : 0.35 }}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem('sukoon_banner_dismissed', '1'); }}
        /* The cross stays small; the thing you have to hit does not. A 14px
           target is a coin-flip with a thumb. */
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* --------------------------------------------- full-width campaign block */
export function FestiveBanner() {
  const { banners } = useShop();
  const banner = banners.find((b) => b.placement === 'hero');
  if (!banner) return null;

  const p = paletteOf(banner.palette);

  return (
    <section className="wrap py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative overflow-hidden"
        style={{ background: p.bg, color: p.fg, borderRadius: 'var(--r-card)' }}
      >
        {banner.image && (
          <img
            src={banner.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
            loading="lazy"
          />
        )}

        <div className="relative grid items-center gap-6 px-7 py-10 sm:px-12 sm:py-12 lg:grid-cols-[1.5fr_auto]">
          <div>
            {banner.subtitle && (
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em]" style={{ color: p.accent }}>
                {banner.subtitle}
              </p>
            )}
            <h2 className="mt-2.5 font-display text-3xl leading-tight sm:text-4xl">{banner.title}</h2>
            {banner.message && (
              <p className="mt-3 max-w-xl text-[0.94rem] leading-relaxed opacity-85">{banner.message}</p>
            )}
            {banner.code && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-[var(--r-btn)] border px-3.5 py-2 text-[0.78rem]"
                 style={{ borderColor: `${p.accent}66` }}>
                <Tag size={13} strokeWidth={1.8} style={{ color: p.accent }} />
                Use code <strong className="font-semibold tracking-wide">{banner.code}</strong>
              </p>
            )}
          </div>

          <Link
            to={banner.link || '/shop'}
            className="btn btn-lg justify-self-start lg:justify-self-end"
            style={{ background: p.accent, color: p.bg, border: `1px solid ${p.accent}` }}
          >
            {banner.cta || 'Shop now'} <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
