/* Cloudflare entry point for the storefront.
 *
 * Two jobs, and the order matters:
 *
 *   /api/*, /uploads/*  ->  forwarded to the Express API, wherever it runs
 *   everything else      ->  the built React app out of ./dist
 *
 * The forwarding is the point. The client fetches relative paths -- see
 * `fetch(`/api${path}`)` in src/lib/api.js -- which means "the same site I was
 * served from". Keeping that true is what lets the API live on a different
 * machine without touching a line of client code and without the browser
 * treating it as a cross-origin request, which would drag in CORS preflights
 * and cookie rules for no benefit.
 *
 * `run_worker_first` is set in wrangler.jsonc so this runs before the asset
 * router. Without it the SPA fallback would answer /api/products with
 * index.html -- every asset path matches once not_found_handling is
 * single-page-application, so the Worker would never see the request.
 */

const API_PREFIXES = ['/api/', '/uploads/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      if (!env.API_ORIGIN) {
        /* Deployed without the API address set. Say so plainly rather than
           letting the SPA render an empty shop and blame the network. */
        return Response.json(
          { error: 'API_ORIGIN is not configured on this Worker.' },
          { status: 503 },
        );
      }

      const target = new URL(url.pathname + url.search, env.API_ORIGIN);

      /* `new Request(target, request)` carries the method, headers and body
         across unchanged. That matters for two routes in particular: the
         Razorpay webhook is signed over the exact bytes of its body, and
         /api/upload sends multipart form data. Re-reading or re-serialising
         either one would break it.
         `redirect: 'manual'` so a redirect from the API is handed back to the
         browser as-is instead of being chased from inside the Worker, which
         would lose the original URL. */
      return fetch(new Request(target, request), { redirect: 'manual' });
    }

    return env.ASSETS.fetch(request);
  },
};
