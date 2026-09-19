import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Play, Quote, X, ShoppingBag, Check } from 'lucide-react';

import { inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';

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

/**
 * The bracelet a review is about, with a way to buy it.
 *
 * The whole point of a video review: someone watches a customer wearing a
 * piece and can add that exact piece without hunting for it in the shop. The
 * product travels with the review from the API, so this costs no extra request.
 */
function ProductStrip({ product, compact = false }) {
  const { addToCart } = useShop();
  const [added, setAdded] = useState(false);
  const soldOut = product.stock === 0;

  const add = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'border-t border-line bg-surface p-2.5'}`}>
      <Link
        to={`/product/${product.slug}`}
        className="flex min-w-0 flex-1 items-center gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" loading="lazy" decoding="async"
            className="h-10 w-10 shrink-0 rounded-[var(--r-btn)] object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-btn)] bg-bg2 text-[0.7rem] text-muted">
            {product.name?.[0] || 'S'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block line-clamp-1 text-[0.78rem] ${compact ? 'text-white' : ''}`}>{product.name}</span>
          <span className={`block text-[0.76rem] font-medium tnum ${compact ? 'text-white/80' : 'text-muted'}`}>
            {inr(product.price)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        className="btn btn-primary btn-sm shrink-0 !px-2.5 !text-[0.7rem] disabled:opacity-45"
      >
        {added
          ? <><Check size={12} strokeWidth={2.4} /> Added</>
          : <><ShoppingBag size={12} strokeWidth={1.7} /> {soldOut ? 'Sold out' : 'Add'}</>}
      </button>
    </div>
  );
}

/* A video only loads once the visitor asks for it. Embedding ten iframes on the
   homepage would pull megabytes of third-party script before anyone pressed play. */
function VideoCard({ review, onOpen }) {
  const poster = review.photo || review.thumbnail;
  /* A clip we host can be its own thumbnail. `preload="metadata"` fetches the
     header and the first frame, a few kilobytes, not the whole file -- which is
     what makes this cheaper than it looks and better than the flat brand-soft
     rectangle a hosted video used to get. A YouTube or Instagram embed cannot
     do this, so those still fall back to the placeholder. */
  const selfPoster = !poster && review.video?.kind === 'file' ? review.video.embed : null;

  return (
    /* Not one big <button>: the product strip below carries its own link and
       Add to cart, and a button inside a button is invalid and unclickable. */
    <div
      className="group relative flex h-full flex-col overflow-hidden border border-line bg-surface text-left"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <button onClick={() => onOpen(review)} className="relative block w-full text-left" aria-label={`Play review from ${review.name}`}>
        <div className="aspect-[9/14] w-full bg-bg2">
          {poster ? (
            <img src={poster} alt="" loading="lazy" decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : selfPoster ? (
            <video src={selfPoster} muted playsInline preload="metadata" tabIndex={-1}
              aria-hidden="true"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="h-full w-full bg-[var(--c-brand-soft)]" />
          )}
        </div>
        <span aria-hidden="true" className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, rgba(10,10,8,0.85) 0%, rgba(10,10,8,0.15) 55%, rgba(10,10,8,0) 80%)' }} />
        <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition-transform group-hover:scale-110">
          <Play size={20} className="ml-0.5 fill-current" />
        </span>
        {/* A video review often carries no name and no stars -- the clip is the
            review. Each line appears only if there is something to put in it. */}
        <span className="absolute inset-x-0 bottom-0 block p-4" style={{ color: '#fbf9f4' }}>
          {review.rating > 0 && <Stars n={review.rating} />}
          {review.name && <span className="mt-1.5 block text-[0.86rem] font-medium">{review.name}</span>}
          {review.designation && <span className="block text-[0.74rem] opacity-75">{review.designation}</span>}
          {review.title && <span className="mt-0.5 line-clamp-2 block text-[0.78rem] opacity-80">{review.title}</span>}
        </span>
      </button>

      {review.product && <ProductStrip product={review.product} />}
    </div>
  );
}

function TextCard({ review }) {
  return (
    <figure
      className="flex h-full flex-col overflow-hidden border border-line bg-surface"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <div className="flex flex-1 flex-col p-6">
        <Quote size={20} className="text-accent opacity-40" strokeWidth={1.6} />
        {review.rating > 0 && <Stars n={review.rating} />}
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
            {review.designation && <p className="text-[0.72rem] text-muted">{review.designation}</p>}
          </div>
        </div>
      </div>
      {review.product && <ProductStrip product={review.product} />}
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

        {/* Buying is offered here too: this is where someone is actually
            watching the piece being worn. */}
        {review.product && (
          <div className="mt-3 rounded-[var(--r-card)] border border-white/15 bg-white/10 p-2.5">
            <ProductStrip product={review.product} compact />
          </div>
        )}

        {review.body && <p className="mt-4 text-center text-[0.88rem] leading-relaxed text-white/85">“{review.body}”</p>}
        {review.name && (
          <p className="mt-2 text-center text-[0.8rem] text-white/60">
            {review.name}{review.designation ? ` · ${review.designation}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The customer reviews rail.
 *
 * Nothing is invented here. It used to fall back to three written-in
 * testimonials when no reviews were approved, which put words in the mouths of
 * people who never said them; the section now simply does not render until
 * there is something real to show. Clips lead, because they are the ones that
 * sell the piece being worn.
 */
export default function ReviewsRail({ reviews = [] }) {
  const scroller = useRef(null);
  const [open, setOpen] = useState(null);

  if (!reviews.length) return null;

  const list = [...reviews].sort((a, b) => (b.video ? 1 : 0) - (a.video ? 1 : 0));

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
            Hear from our customers
          </h2>
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
        style={{
          paddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
          scrollPaddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
        }}
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
