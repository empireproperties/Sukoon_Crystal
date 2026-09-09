import { Link } from 'react-router-dom';

import { useShop } from '../lib/store.jsx';
import logoFile from '../assets/logo.jpeg';

/* The master artwork, bundled rather than fetched. Vite fingerprints and
   inlines the import, so the mark is on the page in the first paint instead of
   waiting on a third-party CDN — and the store still renders its own logo when
   Cloudinary is down or was never configured.
   It is also the source of the brand hexes: #2a513c disc, #d4af16 foil,
   #f5f4f0 ground. See the `sukoon-signature` colourway in index.css. */
export const LOGO_SRC = logoFile;

/* The CDN copy is kept for the one job the bundle cannot do: <link rel="icon">
   in index.html needs a URL that exists before the JS bundle is parsed. The
   source PNG sits on a black square, so `c_crop` trims to the artwork and
   `r_max` rounds it — that is what removes the black corners without needing
   background removal. */
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
  /* An uploaded logo wins; otherwise the bundled artwork. */
  const src = settings?.logo || LOGO_SRC;

  const inner = (
    <>
      <span
        className="block shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          /* The artwork is a 1091x1051 JPEG whose disc is 826px across, so under
             `cover` the disc fills only 78.6% of a square box and the rest is the
             ivory the disc was photographed on. Invisible on a light colourway --
             the ivory is the page ground -- and a pale ring around the mark on a
             dark one. 1/0.786 = 1.272; 1.28 over-fills slightly so the antialiased
             edge is cropped rather than shown. */
          style={{ width: size, height: size, objectFit: 'cover', transform: 'scale(1.28)' }}
        />
      </span>
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
