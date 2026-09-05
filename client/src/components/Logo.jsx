import { Link } from 'react-router-dom';

import { useShop } from '../lib/store.jsx';

/* The mark, cropped to its disc. The source PNG sits on a black square, so
   `c_crop` trims to the artwork and `r_max` rounds it — that is what removes
   the black corners without needing background removal. */
const MARK_BASE = 'https://res.cloudinary.com/enf4l41d/image/upload';
const MARK_ID = 'v1788407185/sukoon/brand/logo-mark.png';
export const markUrl = (px = 96) =>
  `${MARK_BASE}/c_crop,g_center,w_0.93,h_0.93/r_max,w_${px * 2},f_auto,q_auto/${MARK_ID}`;

/**
 * The mark carries its own "Sukoon Crystal Solutions" lettering, which is
 * unreadable below about 120px. So at header sizes we show the disc *beside*
 * set type rather than relying on the lettering inside it — the lockup stays
 * legible at 40px, which is the whole point of a lockup.
 */
export default function Logo({
  size = 40,
  showText = true,
  /* Extra classes for the type block. The header passes `hidden sm:block` so a
     narrow phone gets the mark alone — done here rather than by rendering two
     <Logo>s, because Tailwind's `inline-flex` on the root beats a `hidden`
     utility passed from outside and both would end up visible. */
  textClassName = '',
  stacked = false,
  className = '',
  to = '/',
}) {
  const { settings } = useShop();
  const src = settings?.logo || markUrl(size);

  const inner = (
    <>
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        className="shrink-0 rounded-full"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {showText && (
        <span className={`${stacked ? 'text-center' : ''} ${textClassName}`}>
          <span
            className="block font-display leading-none tracking-[0.15em]"
            style={{ fontSize: size * 0.42 }}
          >
            SUKOON
          </span>
          <span
            className="mt-[0.35em] block font-medium uppercase leading-none tracking-[0.3em] text-muted"
            style={{ fontSize: size * 0.155 }}
          >
            Crystal Solutions
          </span>
        </span>
      )}
    </>
  );

  const classes = `inline-flex items-center gap-2.5 ${stacked ? 'flex-col gap-2' : ''} ${className}`;

  if (!to) return <span className={classes}>{inner}</span>;
  return (
    <Link to={to} className={classes} aria-label="Sukoon Crystal Solutions — home">
      {inner}
    </Link>
  );
}
