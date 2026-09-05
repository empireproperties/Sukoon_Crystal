import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Copy, Check, Sparkles } from 'lucide-react';

import { useShop } from '../lib/store.jsx';
import { BANNER_PALETTES } from './Banners.jsx';

/* Shown when no campaign banner is live. This is what "reverts to the static
   photo after the offer ends" means in practice: the section never disappears
   and never leaves a hole, it just stops advertising a discount. */
const STATIC = {
  title: 'Every piece energised before it reaches you',
  message: 'Cleansed in salt and charged with mantra at our Meerut studio — which is why we never dispatch the same day.',
  cta: 'See how we work',
  link: '/about',
  /* Follows the live theme. 'ink' gives a deep neutral band that carries the
     gold CTA without introducing a second brand colour to the page. */
  palette: 'ink',
};

const paletteOf = (id) => BANNER_PALETTES[id] || BANNER_PALETTES.auto;

/**
 * The mid-page offer strip. An admin banner placed `mid` takes over; when the
 * campaign expires or is deleted the static message takes its place.
 */
export default function OfferBanner() {
  const { banners, toast } = useShop();
  const [copied, setCopied] = useState(false);

  const live = banners.find((b) => b.placement === 'mid') || null;
  const b = live || STATIC;
  const p = paletteOf(b.palette);
  const hasImage = Boolean(live?.image);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Could not copy — the code is ' + b.code, 'warn');
    }
  };

  return (
    <section className="wrap py-14 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative isolate overflow-hidden"
        style={{ borderRadius: 'var(--r-card)', background: hasImage ? undefined : p.bg, color: p.fg }}
      >
        {hasImage && (
          <>
            <img src={live.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
            <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(10,10,8,0.82) 0%, rgba(10,10,8,0.5) 60%, rgba(10,10,8,0.2) 100%)' }} />
          </>
        )}

        <div className={`relative flex flex-col gap-6 p-8 sm:p-12 md:flex-row md:items-center md:justify-between ${hasImage ? 'min-h-[280px]' : ''}`}
             style={hasImage ? { color: '#fbf9f4' } : undefined}>
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.22em] opacity-75">
              <Sparkles size={12} /> {live ? 'Offer' : 'Our promise'}
            </span>
            <h2 className="mt-3 font-[var(--font-display)] text-[clamp(1.5rem,3.6vw,2.3rem)] leading-tight">
              {b.title}
            </h2>
            {b.subtitle && <p className="mt-1.5 text-[0.9rem] opacity-80">{b.subtitle}</p>}
            {b.message && <p className="mt-3 max-w-lg text-[0.92rem] leading-relaxed opacity-85">{b.message}</p>}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
            {b.code && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-2 border border-current/25 px-4 py-2.5 text-[0.82rem] tracking-wide transition hover:border-current/60"
                style={{ borderRadius: 'var(--r-btn)' }}
              >
                <span className="font-mono tracking-[0.12em]">{b.code}</span>
                {copied ? <Check size={13} /> : <Copy size={13} className="opacity-60" />}
              </button>
            )}
            {b.cta && (
              <Link
                to={b.link || '/shop'}
                className="btn btn-lg"
                style={{ background: hasImage ? '#fbf9f4' : p.accent, color: hasImage ? '#16150f' : p.bg }}
              >
                {b.cta} <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
