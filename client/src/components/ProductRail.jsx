import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

import ProductCard from './ProductCard.jsx';

/**
 * A single row of products that scrolls sideways.
 *
 * Replaces a wrapping grid: two short rows of five read as a stunted grid, and
 * the second row is usually below the fold anyway. One row that slides shows
 * five, hints at more, and keeps the section a fixed height.
 *
 * Built on native scroll-snap rather than a transform carousel, so it keeps
 * touch momentum, keyboard scrolling and the scrollbar-free swipe that phones
 * already do well.
 */
export default function ProductRail({
  products = [],
  loading = false,
  perView = 5,
  viewAllHref = '/shop',
  eyebrow,
  title,
}) {
  const scroller = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    /* 8px of slack: sub-pixel widths mean scrollLeft rarely lands exactly. */
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync, products.length]);

  /* Page by whole cards so a nudge never leaves a sliver of one showing. */
  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector('[data-rail-item]');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(perView / 2)), behavior: 'smooth' });
  };

  const items = loading ? Array.from({ length: perView }) : products;
  if (!loading && !products.length) return null;

  return (
    <section className="py-14 sm:py-20">
      <div className="wrap mb-7 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">{eyebrow}</p>}
          <h2 className="mt-2 font-[var(--font-display)] text-[clamp(1.6rem,4vw,2.4rem)] leading-tight">{title}</h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={viewAllHref}
            className="hidden items-center gap-1.5 text-[0.84rem] text-muted transition-colors hover:text-brand sm:inline-flex"
          >
            View all <ArrowRight size={14} />
          </Link>
          <div className="hidden gap-1.5 md:flex">
            <button
              onClick={() => nudge(-1)}
              disabled={atStart}
              aria-label="Scroll left"
              className="grid h-9 w-9 place-items-center border border-line transition hover:bg-bg2 disabled:opacity-30"
              style={{ borderRadius: 'var(--r-btn)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => nudge(1)}
              disabled={atEnd}
              aria-label="Scroll right"
              className="grid h-9 w-9 place-items-center border border-line transition hover:bg-bg2 disabled:opacity-30"
              style={{ borderRadius: 'var(--r-btn)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scroller}
          className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1"
          style={{
            paddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
            scrollPaddingInline: 'max(1.25rem, calc((100vw - var(--wrap)) / 2))',
          }}
        >
          {items.map((p, i) => (
            <div
              key={p?.id || i}
              data-rail-item
              /* Two on a phone, three on a tablet, `perView` on a desktop. The
                 fractional basis leaves the next card peeking, which is what
                 tells a shopper the row scrolls at all. */
              className="w-[44vw] shrink-0 snap-start sm:w-[30vw] lg:w-[22vw] xl:w-[calc((var(--wrap)-4rem)/5)]"
            >
              {p
                ? <ProductCard product={p} />
                : <div className="aspect-[3/4] animate-pulse bg-bg2" style={{ borderRadius: 'var(--r-card)' }} />}
            </div>
          ))}
        </div>
      </div>

      <Link to={viewAllHref} className="btn btn-lg mx-auto mt-8 flex w-fit border border-line sm:hidden">
        View all products <ArrowRight size={15} />
      </Link>
    </section>
  );
}
