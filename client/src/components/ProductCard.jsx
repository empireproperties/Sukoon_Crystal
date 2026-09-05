import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Check, Images } from 'lucide-react';
import { useState } from 'react';

import ProductImage from './ProductImage.jsx';
import { staggerItem } from './Motion.jsx';
import { inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';

/* What a card is allowed to show. The admin writes settings.card; anything
   missing falls back to this, so an older settings row never blanks a card.
   Star ratings are deliberately absent — they were removed at the owner's
   request, and product.rating is derived from approved reviews anyway. */
export const CARD_FIELDS = [
  ['stone', 'Stone name', 'The material under the product name'],
  ['price', 'Price', 'Selling price. Turning this off hides the price entirely'],
  ['mrp', 'Struck-through MRP', 'Shown only when the MRP is higher than the price'],
  ['discount', 'Discount badge', 'The “25% off” flag on the image'],
  ['bestseller', 'Bestseller flag', 'On products marked as a bestseller'],
  ['stock', 'Stock line', '“In stock”, or “Only 3 left” when running low'],
  ['addToCart', 'Add to cart button', 'Turn off to send shoppers to the product page first'],
];

export const CARD_DEFAULTS = {
  stone: true, price: true, mrp: true, discount: true,
  bestseller: true, stock: true, addToCart: true,
};

export const cardConfig = (settings) => ({ ...CARD_DEFAULTS, ...(settings?.card || {}) });

function useAdd(product) {
  const { addToCart } = useShop();
  const [added, setAdded] = useState(false);
  return {
    added,
    add: (e) => {
      e?.preventDefault();
      e?.stopPropagation();
      addToCart(product);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    },
  };
}

const discountOf = (p) => (p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0);

/**
 * @param showPercent  false on a card that already carries the "29% off" badge
 *                     over the photo — printing the same number twice inside
 *                     one small card reads as a mistake and costs a whole line
 *                     on a phone.
 */
export function Price({ product, className = '', showMrp = true, showPercent = true }) {
  const off = discountOf(product);
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className="font-medium tnum">{inr(product.price)}</span>
      {showMrp && off > 0 && (
        <>
          <span className="text-[0.8rem] text-muted line-through tnum">{inr(product.mrp)}</span>
          {showPercent && <span className="text-[0.75rem] text-sale">{off}% off</span>}
        </>
      )}
    </span>
  );
}

/* Renders inline by design so it can sit next to other text. Callers that want
   it on its own line must wrap it — putting `block` in `className` does not
   work, because Tailwind emits `inline-flex` after `block` and the later rule
   wins no matter what order the classes are written in. That is exactly how
   "29% off" and "In stock" ended up printed on top of each other. */
export function StockLine({ stock, className = '' }) {
  if (stock === 0) return <span className={`text-[0.75rem] text-sale ${className}`}>Out of stock</span>;
  if (stock <= 5) return <span className={`text-[0.75rem] text-sale ${className}`}>Only {stock} left</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-[0.75rem] text-ok ${className}`}>
      <Check size={11} strokeWidth={2.8} /> In stock
    </span>
  );
}

/**
 * One product card, replacing the four per-design variants.
 *
 * Left-aligned rather than centred: names run to two lines and centred type
 * with a ragged second line reads as an accident. The whole tile is a link, so
 * the shopper never has to find the small text target.
 */
function Card({ product, config }) {
  const { added, add } = useAdd(product);
  const off = discountOf(product);
  const soldOut = product.stock === 0;

  const shots = product.images || [];
  const second = shots[1] || '';

  /* The second photo is only requested once a pointer actually reaches the
     card. A shop page holding forty products would otherwise pull eighty
     images before anyone has looked at one. Once armed it stays mounted, so
     the swap is instant on every hover after the first. */
  const [armed, setArmed] = useState(false);
  const arm = (e) => { if (e?.pointerType !== 'touch') setArmed(true); };

  return (
    <article
      onPointerEnter={arm}
      onFocus={() => setArmed(true)}
      className="group relative flex h-full flex-col overflow-hidden border border-line bg-surface transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-[var(--shadow-card)]"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <Link to={`/product/${product.slug}`} className="relative block overflow-hidden bg-bg2" tabIndex={-1} aria-hidden="true">
        {/* Square, not 4:5. A portrait crop on a 320px-wide card is 400px of
            photo before a single word of copy, which is what made the tile run
            past the fold on a desktop grid. */}
        <ProductImage product={product} className="aspect-square" zoom hoverSrc={armed ? second : ''} />

        {config.bestseller && product.bestseller && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[0.6rem] font-medium text-onbrand sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[0.66rem]">
            Bestseller
          </span>
        )}

        {/* Bottom-left, not top-left. Every product photo has the Sukoon
            medallion burnt into its top-left corner, and the flag landed
            squarely on it. */}
        {config.discount && off > 0 && (
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-ink/85 px-2 py-0.5 text-[0.6rem] font-medium text-bg backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[0.66rem]">
            {off}% off
          </span>
        )}

        {/* Says there is more to see without making anyone hover to find out —
            which is the only hint a touch screen ever gets. It steps aside
            while the second photo is showing. */}
        {shots.length > 1 && !soldOut && (
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-surface/85 px-2 py-1 text-[0.64rem] text-muted backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-0">
            <Images size={10} strokeWidth={1.9} /> {shots.length}
          </span>
        )}

        {soldOut && (
          <span className="absolute inset-0 grid place-items-center bg-surface/70 text-[0.72rem] uppercase tracking-[0.18em] text-ink backdrop-blur-[1px]">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        {/* Two lines are reserved whether the name needs them or not, so cards
            in a row match without a ragged hole above the price. The height
            lives on this wrapper, never on the clamped element itself: a
            min-height on a `-webkit-box` fights the clamp and lets a third line
            show through, sliced in half. */}
        <div className="min-h-[2.3rem] sm:min-h-[2.4rem]">
          <h3 className="text-[0.84rem] font-medium leading-snug line-clamp-2 sm:text-[0.9rem]">
            {/* The stretched link makes the entire card clickable without
                nesting the Add to cart button inside an anchor. */}
            <Link to={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
              {product.name}
            </Link>
          </h3>
        </div>

        {config.stone && product.stone && (
          <p className="mt-1 line-clamp-1 text-[0.72rem] text-muted sm:text-[0.76rem]">{product.stone}</p>
        )}

        <div className="mt-auto pt-2 sm:pt-2.5">
          {/* Price and stock share a row. They are separate flex children of a
              wrapper, never nested spans, so the inline-flex on each one is
              left alone — the overlap that produced was the whole reason
              StockLine carries the warning above. `flex-wrap` drops stock onto
              its own line only when a long price genuinely leaves no room. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            {config.price && (
              <Price
                product={product}
                className="text-[0.92rem] sm:text-[0.98rem]"
                showMrp={config.mrp}
                showPercent={!(config.discount && off > 0)}
              />
            )}
            {config.stock && <StockLine stock={product.stock} />}
          </div>

          {config.addToCart && (
            <motion.button
              onClick={add}
              disabled={soldOut}
              whileTap={soldOut ? undefined : { scale: 0.975 }}
              /* Sits above the stretched link so the click reaches the button. */
              /* `!px-2` on the phone: the default button padding plus uppercase
                 tracking does not leave room for the label on a two-up grid. */
              className="btn btn-primary relative z-10 mt-2.5 w-full !py-3 !px-2 !text-[0.66rem] disabled:opacity-45 sm:!px-4 sm:!text-[var(--btn-size)]"
            >
              {added
                ? <><Check size={13} strokeWidth={2.4} /> Added</>
                : <><ShoppingBag size={13} strokeWidth={1.7} /> {soldOut ? 'Sold out' : 'Add to cart'}</>}
            </motion.button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ProductCard({ product, animate = true }) {
  const { settings } = useShop();
  const config = cardConfig(settings);
  if (!animate) return <Card product={product} config={config} />;
  return (
    <motion.div variants={staggerItem} className="h-full">
      <Card product={product} config={config} />
    </motion.div>
  );
}
