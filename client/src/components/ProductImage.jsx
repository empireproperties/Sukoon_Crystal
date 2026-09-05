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
        alt={name}
        sizes={sizes}
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
