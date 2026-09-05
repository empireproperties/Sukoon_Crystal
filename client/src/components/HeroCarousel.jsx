import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, BadgeCheck, Sparkles, Truck, RotateCcw } from 'lucide-react';

import { useShop } from '../lib/store.jsx';

/* Shown when the admin has uploaded no slides, or every campaign has expired. */
export const FALLBACK_SLIDE = {
  id: 'fallback',
  eyebrow: 'Certified astrologer · 10+ years',
  title: 'Stones chosen for you,\nnot for a shelf',
  subtitle: 'Swati reads your chart first, then recommends the stone.',
  cta: 'Explore the collection',
  link: '/shop',
  image: '',
};

/* A first-time visitor decides whether a crystal shop is real in about two
   seconds, so the four answers to "is this genuine?" sit under the banner. */
const TRUST = [
  { icon: BadgeCheck, label: '100% genuine stones' },
  { icon: Sparkles, label: 'Energised before dispatch' },
  { icon: Truck, label: 'Free shipping above ₹999' },
  { icon: RotateCcw, label: '7-day replacement' },
];

/* The three layouts, so the admin can pick one without a code change.
   `?hero=split|frame|strip` overrides it for a quick side-by-side look. */
export const HERO_STYLES = [
  { id: 'strip', name: 'Merged', blurb: 'One card — the photo fades into the background behind the copy. No seam.' },
  { id: 'split', name: 'Split', blurb: 'Copy on a colour half, photo on the other, with a clean edge between them.' },
  { id: 'frame', name: 'Framed', blurb: 'Copy on the page, photo in its own rounded frame beside it. Airy and editorial.' },
];

/* The seeded placeholders are square catalogue shots padded out to banner width
   with a flat colour. Each layout wants a different crop, so the transform is
   rewritten per layout rather than baked into the stored URL. A URL that is not
   one of ours passes through untouched. */
function srcFor(url, shape) {
  if (typeof url !== 'string' || !url.includes('/image/upload/')) return url;
  const t = {
    /* portrait-ish half */ split: 'c_fill,g_auto,w_1200,h_1000',
    /* squarish frame    */ frame: 'c_fill,g_auto,w_1200,h_1100',
    /* wide, masked band */ strip: 'c_fill,g_auto,w_1500,h_1000',
  }[shape] || 'c_fill,g_auto,w_1600,h_900';
  return url.replace(/\/image\/upload\/[^/]*\//, `/image/upload/${t},f_auto,q_auto/`);
}

const AUTOPLAY_MS = 6500;

/* ------------------------------------------------------------- shared bits */

function Copy({ slide, ink, accent, size = 'md' }) {
  const h = size === 'sm'
    ? 'text-[clamp(1.3rem,2.4vw,1.9rem)]'
    : 'text-[clamp(1.5rem,3vw,2.5rem)]';
  return (
    <>
      {slide.eyebrow && (
        <p className="flex items-center gap-2.5 text-[0.66rem] uppercase tracking-[0.22em]" style={{ color: accent }}>
          <span className="h-px w-6" style={{ background: accent }} />
          {slide.eyebrow}
        </p>
      )}
      {slide.title && (
        <h1 className={`mt-3 whitespace-pre-line font-[var(--font-display)] leading-[1.1] ${h}`} style={{ color: ink }}>
          {slide.title}
        </h1>
      )}
      {slide.subtitle && (
        <p className="mt-3 max-w-md text-[0.88rem] leading-relaxed opacity-75" style={{ color: ink }}>
          {slide.subtitle}
        </p>
      )}
      {slide.cta && (
        <Link to={slide.link || '/shop'} className="btn btn-primary btn-lg mt-6 inline-flex">
          {slide.cta} <ArrowRight size={15} />
        </Link>
      )}
    </>
  );
}

function Controls({ list, index, setIndex, go, className = '' }) {
  if (list.length < 2) return null;
  return (
    <div className={`z-20 flex items-center gap-2.5 ${className}`}>
      {/* The dash you see is 3px tall. The button around it is 32px, because a
          3px target cannot be hit with a thumb — the padding is the tap area
          and the dash inside it is the design. */}
      <div className="-my-3 flex items-center">
        {list.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className="grid h-8 place-items-center px-1.5"
          >
            <span
              className="block h-[3px] rounded-full transition-all"
              style={{ width: i === index ? 22 : 10, background: 'var(--c-ink)', opacity: i === index ? 0.8 : 0.25 }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => go(index - 1)} aria-label="Previous slide"
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/90 text-ink backdrop-blur transition hover:bg-bg2">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => go(index + 1)} aria-label="Next slide"
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/90 text-ink backdrop-blur transition hover:bg-bg2">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const Photo = ({ slide, shape, className = '', style }) =>
  slide.image ? (
    <picture>
      {slide.mobileImage && <source media="(max-width: 640px)" srcSet={srcFor(slide.mobileImage, shape)} />}
      <img
        src={srcFor(slide.image, shape)}
        alt={slide.title ? '' : slide.eyebrow || 'Featured'}
        className={`h-full w-full object-cover ${className}`}
        style={style}
        /* Largest paint on the page — never lazy. */
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
    </picture>
  ) : (
    <div className={`h-full w-full bg-bg2 ${className}`} style={style} />
  );

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] },
};

/* ═══════════════════════════ 1 · SPLIT ══════════════════════════════════ */
/* Two halves of one card: copy on a colour ground, photo alongside. The photo
   is half-width, so it never dominates the way a full-bleed background did. */
function SplitHero({ list, index, setIndex, go, slide, ink, accent, panel }) {
  return (
    <div className="wrap">
      <div className="overflow-hidden border border-line shadow-[var(--shadow-card)]" style={{ borderRadius: 18 }}>
        <div className="grid sm:grid-cols-2">
          <div className="flex flex-col justify-center px-7 py-10 sm:px-9 sm:py-12 lg:px-12" style={{ background: panel }}>
            <AnimatePresence mode="wait">
              <motion.div key={slide.id} {...fade} className="w-full max-w-md">
                <Copy slide={slide} ink={ink} accent={accent} />
              </motion.div>
            </AnimatePresence>
            <Controls list={list} index={index} setIndex={setIndex} go={go} className="mt-7" />
          </div>
          <div className="relative order-first aspect-[4/3] sm:order-last sm:aspect-auto">
            <AnimatePresence mode="wait">
              <motion.div key={`${slide.id}-i`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }} className="absolute inset-0">
                <Photo slide={slide} shape="split" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 2 · FRAMED ═════════════════════════════════ */
/* No card at all — the copy sits on the page and the photograph is a contained,
   rounded frame beside it. The most restrained of the three. */
function FrameHero({ list, index, setIndex, go, slide, ink, accent }) {
  return (
    <div className="wrap">
      <div className="grid items-center gap-8 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="relative order-last lg:order-first">
          <AnimatePresence mode="wait">
            <motion.div key={slide.id} {...fade}>
              <Copy slide={slide} ink={ink} accent={accent} />
            </motion.div>
          </AnimatePresence>
          <Controls list={list} index={index} setIndex={setIndex} go={go} className="mt-8" />
        </div>
        <div className="relative order-first aspect-[5/4] overflow-hidden shadow-[var(--shadow-card)] lg:order-last lg:aspect-[4/3.4]"
             style={{ borderRadius: 18 }}>
          <AnimatePresence mode="wait">
            <motion.div key={`${slide.id}-i`} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.55 }} className="absolute inset-0">
              <Photo slide={slide} shape="frame" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 3 · STRIP ══════════════════════════════════ */
/* One card, not two halves.
 *
 * The photograph is masked so its inner edge fades to nothing, letting it
 * emerge out of the card's own background instead of butting against the copy
 * with a hard seam. That is the whole trick: same colour underneath, and a
 * gradient alpha mask on the image rather than a gradient drawn on top of it —
 * an overlay would tint the photo, a mask actually dissolves it.
 *
 * Horizontal on a wide screen, vertical when it stacks on a phone.
 */
function StripHero({ list, index, setIndex, go, slide, ink, accent, panel }) {
  const fadeX = 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 22%, #000 58%)';
  const fadeY = 'linear-gradient(180deg, #000 0%, #000 34%, rgba(0,0,0,0.30) 66%, transparent 92%)';

  return (
    <div className="wrap">
      <div
        className="relative overflow-hidden border border-line shadow-[var(--shadow-card)]"
        style={{ borderRadius: 18, background: panel }}
      >
        {/* Photograph sits inside the card and fades into it. */}
        <div className="absolute inset-x-0 top-0 h-[42%] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[62%]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${slide.id}-i`}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Photo
                slide={slide}
                shape="strip"
                className="[mask-image:var(--fade-y)] [-webkit-mask-image:var(--fade-y)] sm:[mask-image:var(--fade-x)] sm:[-webkit-mask-image:var(--fade-x)]"
                style={{ '--fade-x': fadeX, '--fade-y': fadeY }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Copy sits above the fade, on the card's own colour. */}
        <div className="relative flex flex-col justify-center px-7 pb-9 pt-[44%] sm:w-[58%] sm:px-10 sm:py-12 sm:pt-12">
          <AnimatePresence mode="wait">
            <motion.div key={slide.id} {...fade} className="max-w-md">
              <Copy slide={slide} ink={ink} accent={accent} />
            </motion.div>
          </AnimatePresence>
          <Controls list={list} index={index} setIndex={setIndex} go={go} className="mt-7" />
        </div>
      </div>
    </div>
  );
}

const LAYOUTS = { split: SplitHero, frame: FrameHero, strip: StripHero };

/* ═════════════════════════════════ root ════════════════════════════════ */
export default function HeroCarousel({ slides = [] }) {
  const { settings } = useShop();
  const [params] = useSearchParams();
  const list = slides.length ? slides : [FALLBACK_SLIDE];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  useEffect(() => { setIndex((i) => (i >= list.length ? 0 : i)); }, [list.length]);

  const go = useCallback((next) => setIndex((i) => (next + list.length) % list.length), [list.length]);

  useEffect(() => {
    if (paused || list.length < 2) return undefined;
    if (typeof document !== 'undefined' && document.hidden) return undefined;
    const t = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, list.length, go]);

  const slide = list[index] || list[0];
  const light = slide.tone !== 'dark';
  const ink = light ? 'var(--c-ink)' : '#fdfaf4';
  const accent = 'var(--c-accent)';
  /* Warm tint from the live palette, so the copy ground follows the theme. */
  const panel = light
    ? 'color-mix(in oklab, var(--c-accent) 7%, var(--c-surface))'
    : 'color-mix(in oklab, var(--c-ink) 94%, black)';

  const chosen = params.get('hero') || settings?.heroStyle || 'strip';
  const Layout = LAYOUTS[chosen] || SplitHero;

  return (
    <section
      className="pt-5 sm:pt-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <Layout {...{ list, index, setIndex, go, slide, ink, accent, panel }} />

      <div className="wrap mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 lg:grid-cols-4">
        {TRUST.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-2 text-[0.78rem] text-muted">
            <Icon size={15} strokeWidth={1.8} className="shrink-0 text-accent" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
