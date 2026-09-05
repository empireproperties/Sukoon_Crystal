# Shopify → this site

One command pulls the store across. Re-run it any time; it updates rather than duplicates.

> **If you are leaving Shopify, do this before the plan lapses.**
> Everything here reads from Shopify's servers. A closed store serves nothing: the public
> product feed goes dark and `cdn.shopify.com` stops serving your images. Run
> `npm run import` while the store is still live, confirm the site works offline from
> Shopify, and only then cancel. See **Cutting the cord** below.

```bash
npm run import -- --store your-shop.myshopify.com
```

That alone brings over **products and collections** — no API key, no CSV export, no app
install. Shopify serves `/products.json` and `/collections.json` publicly on every store.

## Getting orders, customers and pages too

Those are private, so they need a token. Once, in Shopify admin:

**Settings → Apps and sales channels → Develop apps → Create an app →
Configure Admin API scopes** → tick `read_products`, `read_orders`, `read_customers`,
`read_content` → **Install app** → copy the Admin API access token (`shpat_…`).

Then save `server/shopify.config.json` (gitignored — copy `shopify.config.example.json`):

```json
{ "store": "your-shop.myshopify.com", "token": "shpat_..." }
```

and just run `npm run import` — that pulls everything *and* downloads the images. The token
also gives real inventory counts, which the public feed doesn't carry.

## Flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Report what would change; write nothing |
| `--products` `--collections` `--orders` `--customers` `--pages` | Limit to those; default is everything |
| `--since 2026-08-01` | Only orders/customers updated since then — fast incremental sync |
| `--public` | Ignore the token for products, use the public feed |
| `--replace-demo` | Drop the seeded demo orders, keep only real Shopify ones |
| `--default-stock 25` | Stock to assume when Shopify gives no count (public feed only) |
| `--store` `--token` | Override the config file / `SHOPIFY_STORE` / `SHOPIFY_TOKEN` |
| `--download-images` | Pull images off Shopify's CDN into `server/uploads/shopify/` |
| `--width 1200` `--format webp` | Size/format to fetch (defaults); `--full` keeps originals |

Start with `--dry-run` to see the shape of it before anything is written.

## What it does to your data

Matching is on the Shopify id, so a product edited on Shopify updates the same row here.

- **Shopify wins** for name, slug, price, mrp, description, images, variants, tags.
- **Your curation is kept**: `stock`, `rating`, `reviews`, `featured`, `bestseller`, `sold`,
  `sku`, and the astrology fields (`chakra`, `element`, `zodiac`, `stone`, `stones`).
  Tag-derived astrology only fills blanks — it never overwrites a value you set.
- **Nothing is deleted.** A product pulled from Shopify is flagged `missingFromShopify`
  and left in place for you to decide about.
- Existing category taglines are preserved; new Shopify collections are appended.
- Seeded demo orders stay unless you pass `--replace-demo`.

Product categories come from collection membership (first collection wins), falling back
to the Shopify product type.

### Astrology metadata from Shopify tags

The importer reads product tags so this site's fields can be filled from Shopify:

- `chakra:Heart`, `element:Earth`, `zodiac:Taurus`, `stone:Rose Quartz`, `crystal:Amethyst`
- Bare tags work too: `Taurus`, `heart`, `earth` are recognised on their own.

## Stock, honestly

The public feed reports only in-stock / out-of-stock, no numbers. So without a token:
available products get `stock: 25` (change with `--default-stock`) and are marked
`stockUnknown: true`; products Shopify reports as sold out get `stock: 0`. This matters
because the storefront disables Add to Cart at zero. With an Admin token, real counts are
used and the flag is cleared.

## Images — the part that bites

Right now every product image on this site is a `cdn.shopify.com` URL: 89 distinct files,
650 references in `db.json`. **You do not own any of them.** Close the Shopify store and
the whole catalogue goes blank.

```bash
npm run images          # download all of them, rewrite db.json
npm run images -- --dry-run
```

This is folded into `npm run import`, and it is safe to re-run — already-downloaded files
are reused, not re-fetched. Failed downloads keep their Shopify URL rather than turning
into a broken local path, so you can re-run to pick up stragglers.

Files land in `server/uploads/shopify/` and are served by the existing
`/uploads` static route, which Vite already proxies in dev.

### Why it fetches WebP

Shopify's CDN **ignores** a `?format=webp` query parameter but honours the `Accept`
header. Same image: 1349 KB as PNG, 156 KB as WebP. Across the catalogue that is roughly
17 MB instead of 175 MB, so the importer sends `Accept: image/webp` and asks for
`?width=1200`. Pass `--full` if you want the untouched originals for archival.

## Cutting the cord

Order matters. Each step is reversible until the last one.

1. `npm run import -- --store your-shop.myshopify.com --dry-run` — look first.
2. Create the Admin API token (above) so orders and customers come too.
3. `npm run import` — products, collections, orders, customers, pages, and every image.
4. Check `git status`: `server/uploads/shopify/` should hold ~89 files.
5. `grep -c cdn.shopify.com server/data/db.json` — **must be 0** before you cancel.
6. `npm run dev`, click through the shop and a product page. Images must still load.
7. Back up `server/data/db.json` and `server/uploads/` somewhere off this machine.
8. Only now cancel Shopify.

Step 5 is the point of no return. Any URL still pointing at `cdn.shopify.com` is an image
you will lose.

## After importing

Restart the API (`npm run dev`) so it reads the new `data/db.json`. New API routes:
`GET /api/categories`, `GET /api/pages`, `GET /api/pages/:handle`, and
`GET /api/customers` (admin token required).

Once `npm run images` has run, the site no longer depends on Shopify for anything —
you can point a domain at this server and let the Shopify plan lapse.
