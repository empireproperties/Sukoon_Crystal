import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, PhoneCall, ShoppingBag } from 'lucide-react';

/* Hand-rolled rather than a confetti package: sixty absolutely positioned
   squares animated by framer-motion, which is already here, instead of another
   dependency and another canvas on the page. */
const COLOURS = ['#d4af16', '#2a513c', '#b0803a', '#4b5296', '#c47a35', '#fbf9f4'];

function Confetti() {
  /* Fixed once per mount: regenerating on render would restart every piece
     half way down the screen. */
  const pieces = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.random() * 7,
      delay: Math.random() * 0.5,
      duration: 2.2 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 900,
      colour: COLOURS[i % COLOURS.length],
      round: Math.random() > 0.6,
    })),
    []
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.6),
            background: p.colour,
            borderRadius: p.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  );
}

/**
 * What happens the moment a flagged piece reaches the cart.
 *
 * The bracelet is chosen from a birth chart, so the useful next step is the
 * chart itself, and after that a call with Swati. Shown once per add, and
 * never in the way: everything here is a way forward, including the cart.
 */
export default function CelebrateDialog({ product, onClose, onViewCart }) {
  return (
    <AnimatePresence>
      {product && (
        <>
          <Confetti />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} added to your cart`}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[420px] overflow-hidden border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)] sm:p-7"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-bg2 hover:text-ink"
              >
                <X size={16} />
              </button>

              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">Added to your cart</p>
              <h2 className="mt-2 font-[var(--font-display)] text-[1.45rem] leading-snug">{product.name}</h2>

              <p className="mx-auto mt-3 max-w-[320px] text-[0.88rem] leading-relaxed text-muted">
                This piece works best when it is chosen for your chart. Read yours free,
                then talk it through with Swati.
              </p>

              <Link
                to="/birth-chart"
                onClick={onClose}
                className="mt-5 flex items-center justify-between gap-3 border border-line bg-bg2 p-3.5 text-left transition-colors hover:border-brand"
                style={{ borderRadius: 'var(--r-btn)' }}
              >
                <span className="inline-flex items-center gap-2.5 text-[0.88rem]">
                  <Sparkles size={15} strokeWidth={1.9} className="text-accent" />
                  Get your free birth chart
                </span>
                <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-onbrand">Free</span>
              </Link>

              {/* The one the shop actually wants pressed. */}
              <Link to="/book" onClick={onClose} className="btn btn-primary btn-lg mt-3 w-full">
                <PhoneCall size={16} strokeWidth={1.9} /> Book a free consultation call
              </Link>
              <p className="mt-2 text-[0.74rem] text-muted">
                Complimentary, no obligation — she will tell you if you do not need it.
              </p>

              <button
                onClick={onViewCart}
                className="mt-4 inline-flex items-center gap-1.5 text-[0.82rem] text-muted underline underline-offset-2 hover:text-ink"
              >
                <ShoppingBag size={13} strokeWidth={1.8} /> View my cart
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
