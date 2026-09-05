import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Play, Quote, X } from 'lucide-react';

/* Shown until real approved reviews exist. Marked so it is obvious in the code
   that these are placeholders -- the seeded star ratings were cleared from the
   database for exactly this reason, and these must not quietly become "social
   proof" that nobody actually gave. */
const PLACEHOLDERS = [
  { id: 'ph1', name: 'Ananya R.', rating: 5, placeholder: true,
    body: 'Wore the howlite bracelet through a difficult month at work. I cannot explain it, but I reached for it every morning.' },
  { id: 'ph2', name: 'Meera K.', rating: 5, placeholder: true,
    body: 'Swati read my chart before recommending anything. That mattered more to me than the stone itself.' },
  { id: 'ph3', name: 'Devika S.', rating: 4, placeholder: true,
    body: 'The rudraksha is clearly genuine — you can feel the difference against the ones I bought at a market.' },
];

function Stars({ n = 5, size = 13 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} strokeWidth={1.6}
          className={i <= n ? 'fill-[var(--c-accent)] text-[var(--c-accent)]' : 'text-line'} />
      ))}
    </span>
  );
}

/* A video only loads once the visitor asks for it. Embedding ten iframes on the
   homepage would pull megabytes of third-party script before anyone pressed play. */
function VideoCard({ review, onOpen }) {
  const poster = review.photo || review.thumbnail;
  return (
    <button
      onClick={() => onOpen(review)}
      className="group relative block h-full w-full overflow-hidden border border-line text-left"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <div className="aspect-[9/14] w-full bg-bg2">
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-[var(--c-brand-soft)]" />
        )}
      </div>
      <div aria-hidden="true" className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(10,10,8,0.85) 0%, rgba(10,10,8,0.15) 55%, rgba(10,10,8,0) 80%)' }} />
      <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition-transform group-hover:scale-110">
        <Play size={20} className="ml-0.5 fill-current" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-4" style={{ color: '#fbf9f4' }}>
        <Stars n={review.rating} />
        <p className="mt-1.5 text-[0.86rem] font-medium">{review.name}</p>
        {review.title && <p className="mt-0.5 line-clamp-2 text-[0.78rem] opacity-80">{review.title}</p>}
      </div>
    </button>
  );
}

function TextCard({ review }) {
  return (
    <figure
      className="flex h-full flex-col border border-line bg-surface p-6"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <Quote size={20} className="text-accent opacity-40" strokeWidth={1.6} />
      <Stars n={review.rating} />
      {review.title && <figcaption className="mt-3 text-[0.92rem] font-medium leading-snug">{review.title}</figcaption>}
      <blockquote className="mt-2 flex-1 text-[0.88rem] leading-relaxed text-muted">“{review.body}”</blockquote>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        {review.photo ? (
          <img src={review.photo} alt="" className="h-9 w-9 rounded-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-bg2 text-[0.78rem] font-medium text-muted">
            {review.name?.[0] || '·'}
          </span>
        )}
        <div>
          <p className="text-[0.84rem] font-medium">{review.name}</p>
          <p className="text-[0.72rem] text-muted">Verified buyer</p>
        </div>
      </div>
    </figure>
  );
}

function Lightbox({ review, onClose }) {
  if (!review) return null;
  const v = review.video;
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Review from ${review.name}`}
    >
      <button onClick={onClose} aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25">
        <X size={20} />
      </button>
      <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
          {v?.kind === 'file' ? (
            <video src={v.embed} controls autoPlay playsInline className="h-full w-full object-contain" />
          ) : (
            <iframe
              src={`${v?.embed}${v?.kind === 'youtube' ? '?autoplay=1&rel=0' : ''}`}
              title={`Review from ${review.name}`}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          )}
        </div>
        {review.body && <p className="mt-4 text-center text-[0.88rem] leading-relaxed text-white/85">“{review.body}”</p>}
        <p className="mt-2 text-center text-[0.8rem] text-white/60">{review.name}</p>
      </div>
    </div>
  );
}

export default function ReviewsRail({ reviews = [] }) {
  const scroller = useRef(null);
  const [open, setOpen] = useState(null);

  const list = reviews.length ? reviews : PLACEHOLDERS;
  const isPlaceholder = !reviews.length;

  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 420), behavior: 'smooth' });
  };

  return (
    <section className="py-14 sm:py-20">
      <div className="wrap mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">In their words</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[clamp(1.6rem,4vw,2.5rem)] leading-tight">
            What people tell us
          </h2>
          {isPlaceholder && (
            <p className="mt-2 text-[0.78rem] text-muted">
              Example layout — real reviews appear here once approved in the admin.
            </p>
          )}
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button onClick={() => nudge(-1)} aria-label="Scroll left"
            className="grid h-9 w-9 place-items-center border border-line transition hover:bg-bg2"
            style={{ borderRadius: 'var(--r-btn)' }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => nudge(1)} aria-label="Scroll right"
            className="grid h-9 w-9 place-items-center border border-line transition hover:bg-bg2"
            style={{ borderRadius: 'var(--r-btn)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Horizontal rail: snap-scrolls on touch, arrow-driven on desktop. The
          negative margin lets cards bleed to the screen edge on mobile. */}
      <div
        ref={scroller}
        className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ paddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))', scrollPaddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))' }}
        style={{ scrollbarWidth: 'none' }}
      >
        {list.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: Math.min(i, 4) * 0.05 }}
            className="w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[300px]"
          >
            {r.video ? <VideoCard review={r} onOpen={setOpen} /> : <TextCard review={r} />}
          </motion.div>
        ))}
      </div>

      <Lightbox review={open} onClose={() => setOpen(null)} />
    </section>
  );
}
