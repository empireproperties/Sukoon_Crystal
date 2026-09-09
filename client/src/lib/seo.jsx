/* Keeps the document's metadata truthful during client-side navigation.
 *
 * WHO THIS IS FOR
 * Not the AI crawlers -- they never run this. The Cloudflare Worker has already
 * put a real <title>, description and JSON-LD in the HTML before it left the
 * edge, which is what those read. See client/worker.js and server/seo.js.
 *
 * This is for the three cases the Worker cannot reach:
 *
 *   1. React Router navigation. Clicking from the homepage to a product never
 *      touches the Worker, so without this the tab, the bookmark and the
 *      browser history would all still say "Sukoon Crystal Solutions | Certified
 *      Astrology & Energised Crystals" on every page of the site.
 *   2. Google's rendering pass, which runs the bundle and re-reads the head
 *      afterwards. A stale title here would overwrite the good one.
 *   3. Local development, where there is no Worker at all.
 *
 * The copy comes from the same /api/seo/page the Worker calls, so there is one
 * definition of what a page is about rather than two that drift.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { api } from './api.js';

const ID = 'seo-jsonld';

/** Sets one meta tag, creating it if the shell did not ship with it. `key` is
 *  `name` for ordinary meta and `property` for Open Graph -- Facebook's parser
 *  only reads the latter, so the distinction is not cosmetic. */
function meta(key, attr, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function apply(seo) {
  if (seo.title) document.title = seo.title;

  meta('description', 'name', seo.description);
  meta('robots', 'name', seo.robots);
  meta('og:title', 'property', seo.title);
  meta('og:description', 'property', seo.description);
  meta('og:url', 'property', seo.canonical);
  meta('twitter:title', 'name', seo.title);
  meta('twitter:description', 'name', seo.description);

  if (seo.canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = seo.canonical;
  }

  /* The structured data the Worker injected describes the page that was
     *served*, so after a client-side navigation it is about the wrong URL.
     Replacing it is safer than adding a second graph, which would leave two
     conflicting @id claims for the same entity. */
  if (seo.head) {
    const match = seo.head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (match) {
      document.getElementById(ID)?.remove();
      document.head.querySelectorAll('script[type="application/ld+json"]:not([id])')
        .forEach((el) => el.remove());
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = ID;
      /* textContent, never innerHTML: the string is JSON from our own API, but
         this is the one place where getting it wrong would execute it. */
      script.textContent = match[1];
      document.head.appendChild(script);
    }
  }
}

/** Mounted once, in the storefront layout. */
export function useSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    /* The first page of a visit already carries the right metadata -- the
       Worker put it there. Refetching it would be a wasted round trip on the
       one navigation where speed is most visible. */
    const canonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
    if (canonical && new URL(canonical, location.origin).pathname === pathname) return undefined;

    let alive = true;
    api.seoPage(pathname)
      .then((seo) => { if (alive && seo?.title) apply(seo); })
      /* Metadata is not worth a visible error. A stale title is a small cost;
         a toast about it would be a strange thing to show a shopper. */
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);
}
