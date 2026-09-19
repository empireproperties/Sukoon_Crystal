import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Play, Quote, ShoppingBag, Check } from 'lucide-react';

import { inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';

function Stars({ n = 5, size = 12 }) {
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
function ProductStrip({ product }) {
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
    <div className="flex items-center gap-2 border-t border-line p-2">
      <Link to={`/product/${product.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" loading="lazy" decoding="async"
            className="h-8 w-8 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-bg2 text-[0.68rem] text-muted">
            {product.name?.[0] || 'S'}
          </span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[0.72rem]">{product.name}</span>
          <span className="block text-[0.74rem] font-semibold tnum">{inr(product.price)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-label={`Add ${product.name} to cart`}
        className="btn btn-primary shrink-0 !rounded-full !px-2.5 !py-1.5 !text-[0.66rem] disabled:opacity-45"
      >
        {added
          ? <><Check size={11} strokeWidth={2.6} /> Added</>
          : <><ShoppingBag size={11} strokeWidth={1.8} /> {soldOut ? 'Sold' : 'Add'}</>}
      </button>
    </div>
  );
}

/**
 * One review clip.
 *
 * Plays where it sits. It used to open a full-screen overlay, which threw the
 * whole page away to show a clip the visitor was already looking at, and left
 * them somewhere they had to escape from. The poster is the video's own first
 * frame at `preload="metadata"` -- a few kilobytes, not the whole file -- and
 * the bytes only arrive when someone presses play.
 */
function VideoCard({ review }) {
  const [playing, setPlaying] = useState(false);
  const poster = review.photo || review.thumbnail;
  const file = review.video?.kind === 'file';

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-pop)]">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg2">
        {playing ? (
          file ? (
            <video src={review.video.embed} controls autoPlay playsInline
              className="h-full w-full bg-black object-cover" />
          ) : (
            <iframe
              src={`${review.video?.embed}${review.video?.kind === 'youtube' ? '?autoplay=1&rel=0' : ''}`}
              title={review.name ? `Review from ${review.name}` : 'Customer review'}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group/play absolute inset-0 block h-full w-full"
            aria-label={review.name ? `Play review from ${review.name}` : 'Play customer review'}
          >
            {poster ? (
              <img src={poster} alt="" loading="lazy" decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover/play:scale-[1.04]" />
            ) : file ? (
              <video src={review.video.embed} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
                className="h-full w-full object-cover transition-transform duration-700 group-hover/play:scale-[1.04]" />
            ) : (
              <span className="block h-full w-full bg-[var(--c-brand-soft)]" />
            )}

            <span aria-hidden="true" className="absolute inset-0"
              style={{ background: 'linear-gradient(0deg, rgba(10,10,8,0.72) 0%, rgba(10,10,8,0.1) 50%, rgba(10,10,8,0) 75%)' }} />

            <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-ink shadow-md transition-transform duration-300 group-hover/play:scale-110">
              <Play size={16} className="ml-0.5 fill-current" />
            </span>

            {/* A clip often carries no name and no stars, and an empty line
                where they would go looks like something failed to load. */}
            {(review.rating > 0 || review.name) && (
              <span className="absolute inset-x-0 bottom-0 block p-3 text-left" style={{ color: '#fbf9f4' }}>
                {review.rating > 0 && <Stars n={review.rating} />}
                {review.name && <span className="mt-1 block truncate text-[0.78rem] font-medium">{review.name}</span>}
              </span>
            )}
          </button>
        )}
      </div>

      {review.product && <ProductStrip product={review.product} />}
    </article>
  );
}

function TextCard({ review }) {
  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-pop)]">
      <div className="flex flex-1 flex-col p-4">
        <Quote size={18} className="text-accent opacity-40" strokeWidth={1.6} />
        {review.rating > 0 && <span className="mt-1.5"><Stars n={review.rating} /></span>}
        {review.title && <figcaption className="mt-2 text-[0.86rem] font-medium leading-snug">{review.title}</figcaption>}
        <blockquote className="mt-1.5 flex-1 text-[0.82rem] leading-relaxed text-muted line-clamp-6">“{review.body}”</blockquote>
        {review.name && (
          <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3">
            {review.photo ? (
              <img src={review.photo} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-bg2 text-[0.74rem] font-medium text-muted">
                {review.name[0]}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[0.8rem] font-medium">{review.name}</p>
              {review.designation && <p className="truncate text-[0.7rem] text-muted">{review.designation}</p>}
            </div>
          </div>
        )}
      </div>
      {review.product && <ProductStrip product={review.product} />}
    </figure>
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

  if (!reviews.length) return null;

  const list = [...reviews].sort((a, b) => (b.video ? 1 : 0) - (a.video ? 1 : 0));

  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 420), behavior: 'smooth' });
  };

  return (
    <section className="py-12 sm:py-16">
      <div className="wrap mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">In their words</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[clamp(1.5rem,3.4vw,2.2rem)] leading-tight">
            Hear from our customers
          </h2>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button onClick={() => nudge(-1)} aria-label="Scroll left"
            className="grid h-9 w-9 place-items-center rounded-full border border-line transition hover:bg-bg2">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => nudge(1)} aria-label="Scroll right"
            className="grid h-9 w-9 place-items-center rounded-full border border-line transition hover:bg-bg2">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Horizontal rail: snap-scrolls on touch, arrow-driven on desktop. The
          padding lets cards bleed to the screen edge on mobile.
          Cards are deliberately small -- a 300px-wide card at 9:14 stood 470px
          tall, which put one review on a laptop screen and nothing else. */}
      <div
        ref={scroller}
        className="hide-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-3 pt-1 sm:gap-4"
        style={{
          paddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
          scrollPaddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
        }}
      >
        {list.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(i, 4) * 0.05 }}
            className="w-[48vw] max-w-[210px] shrink-0 snap-start sm:w-[210px]"
          >
            {r.video ? <VideoCard review={r} /> : <TextCard review={r} />}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
