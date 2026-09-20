import { useState } from 'react';

/**
 * Product photography with a calm load: a neutral tone holds the box until the
 * real image decodes, then it fades in. Falls back to a lettered tile if the
 * photo is missing or fails, so a grid never breaks.
 *
 * `hoverSrc` layers a second photo on top that appears while the surrounding
 * `.group` is hovered or focused. The caller decides when to pass it — a grid
 * of forty products must not download eighty photos on load.
 */
/* Cloudinary serves whatever width the URL asks for, and every stored URL
   asks for 1200px -- so a phone showing two cards to a row downloaded a
   picture six times wider than the space it was painted into. This swaps the
   transform segment for a set of widths and lets the browser choose using
   `sizes`, which every caller already passes.
   Written with string operations rather than a regular expression: the
   pattern is all slashes, and every layer it passes through wants to escape
   them differently. A URL that is not one of ours comes back undefined and
   simply has no srcset. */
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';
const UPLOAD = '/image/upload/';
const WIDTHS = [240, 360, 480, 640, 960, 1200];

/** True for "v1789798859", the version segment Cloudinary puts before the id. */
const isVersion = (seg) =>
  seg.length > 1 && seg[0] === 'v' && [...seg.slice(1)].every((c) => c >= '0' && c <= '9');

export function srcSetFor(url) {
  const s = String(url || '');
  const at = s.indexOf(UPLOAD);
  if (!s.startsWith(CLOUDINARY_PREFIX) || at === -1) return undefined;

  const base = s.slice(0, at + UPLOAD.length);
  const parts = s.slice(at + UPLOAD.length).split('/');
  /* Drop whatever transform is already there; the version segment stays. */
  if (parts.length > 1 && !isVersion(parts[0])) parts.shift();
  const rest = parts.join('/');
  if (!rest) return undefined;

  return WIDTHS.map((w) => `${base}f_auto,q_auto,w_${w}/${rest} ${w}w`).join(', ');
}

export default function ProductImage({
  product = {},
  src,
  index = 0,
  className = '',
  imgClassName = '',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px',
  priority = false,
  zoom = false,
  hoverSrc = '',
}) {
  const url = src || product.images?.[index] || product.image || '';
  const [state, setState] = useState(url ? 'loading' : 'error');
  const [altReady, setAltReady] = useState(false);
  const name = product.name || 'Product';

  /* Callers often position the wrapper themselves (`absolute inset-0` covers).
     Adding our own `relative` in that case leaves both utilities on the element,
     `relative` wins, and the image drops back into flow at its natural height —
     which is how a hero ends up two screens tall. Only add it when absent. */
  const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className);
  const base = positioned ? '' : 'relative';

  if (!url || state === 'error') {
    return (
      <div className={`${base} flex items-center justify-center bg-bg2 ${className}`}>
        <span className="font-display text-3xl text-muted/50">{name.trim()[0] || 'S'}</span>
      </div>
    );
  }

  return (
    <div className={`${base} overflow-hidden bg-bg2 ${className}`}>
      <img
        src={url}
        srcSet={srcSetFor(url)}
        alt={name}
        sizes={sizes}
        /* The one picture the page is judged on should not queue behind the
           rest of the grid. */
        fetchpriority={priority ? 'high' : undefined}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          state === 'ready' ? 'opacity-100' : 'opacity-0'
        } ${zoom ? 'img-zoom' : ''} ${imgClassName}`}
      />

      {/* Fades in over the first photo rather than cross-fading with it — two
          images at half opacity would show the empty tile through the middle of
          the transition. Held back until it has actually decoded, so a slow
          connection never flashes a blank frame under the cursor. */}
      {hoverSrc && (
        <img
          src={hoverSrc}
          srcSet={srcSetFor(hoverSrc)}
          alt=""
          aria-hidden="true"
          sizes={sizes}
          loading="lazy"
          decoding="async"
          onLoad={() => setAltReady(true)}
          className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 ${
            altReady ? 'group-hover:opacity-100 group-focus-within:opacity-100' : ''
          } ${zoom ? 'img-zoom' : ''} ${imgClassName}`}
        />
      )}

      {state === 'loading' && <span className="skeleton absolute inset-0" />}
    </div>
  );
}
