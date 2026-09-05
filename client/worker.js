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
 * `run_worker_first` in wrangler.jsonc lists exactly these two prefixes, so
 * this runs before the asset router for them and not at all for anything else.
 * Without it the SPA fallback would answer /api/products with index.html --
 * every path matches an asset once not_found_handling is
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

  /* Keeps a free-tier API awake.
   *
   * Render's free plan stops the server after 15 minutes with no traffic, and
   * starting it again takes the better part of a minute -- which the next
   * shopper spends looking at an empty page. This pings /api/health every ten
   * minutes so the idle timer never runs out.
   *
   * Cron triggers are free, and one request every ten minutes is ~4,300 a
   * month against a limit of 100,000 a day, so this costs nothing on either
   * side. Delete the `triggers` block in wrangler.jsonc once the API moves to
   * a host that does not sleep. */
  async scheduled(_event, env, ctx) {
    if (!env.API_ORIGIN) return;
    ctx.waitUntil(
      fetch(new URL('/api/health', env.API_ORIGIN)).catch(() => {
        /* A failed ping is not worth retrying: the next one is ten minutes
           away, and the API being down is not something this can fix. */
      }),
    );
  },
};
