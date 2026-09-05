# Shopify → CockroachDB + Cloudinary + Razorpay

The whole move, in order. Every step before the last is reversible.

```bash
npm run import                      # Shopify -> data/db.json   (needs the store live)
npm run migrate:cockroach:dry     # show what would change    (writes nothing)
npm run migrate:cockroach -- --cloudinary   # -> CockroachDB + Cloudinary
```

> **Storage is CockroachDB.** The MongoDB path below is the earlier plan, kept
> because `npm run migrate` still works. `DATABASE_URL` takes precedence over
> `MONGODB_URI`, so a leftover Mongo string is ignored rather than conflicting.

---

## 0. Before you touch anything

Read `SHOPIFY-IMPORT.md` for the import flags. The one rule that matters: **run
the import while the Shopify plan is still active.** A closed store serves no
product feed and no images.

## 1. Credentials

Copy `server/.env.example` to `server/.env` and fill it in. That file is
gitignored; nothing in it is ever committed.

**MongoDB Atlas** — create a free M0 cluster. Database Access → add a user.
Network Access → allow your IP (or `0.0.0.0/0` while testing). Connect →
Drivers → copy the URI into `MONGODB_URI`. URL-encode the password if it has
symbols in it: `@` becomes `%40`.

**Cloudinary** — Dashboard → Product Environment Credentials → copy the
"API environment variable" line into `CLOUDINARY_URL`.

**Razorpay** — Settings → API Keys. Start with `rzp_test_*`. Then Settings →
Webhooks → add `https://<your-domain>/api/payments/razorpay/webhook`,
subscribe to `payment.captured`, and put the same secret in
`RAZORPAY_WEBHOOK_SECRET`.

## 2. Pull from Shopify

```bash
npm run import -- --store your-shop.myshopify.com --token shpat_...
```

Products and collections are public. Orders, customers and pages need the
Admin token. Idempotent — re-run it as often as you like.

## 3. Migrate

```bash
npm run migrate:cockroach:dry     # read the summary carefully
npm run migrate
```

This does three things:

1. **Strips the seeded demo data.** The 393 invented orders, 34 bookings and
   11,714 fake visits do not reach Atlas. Real Shopify orders (`shopifyId`)
   and anything placed through the live site (`source: 'Website'`) survive.
   Each product's `sold` count is recomputed from the orders that remain.
2. **Moves images to Cloudinary.** Cloudinary fetches each Shopify CDN URL
   itself — nothing is downloaded here. Every reference in the data is
   rewritten to a Cloudinary URL carrying `f_auto,q_auto,w_1200`, so one
   stored original serves WebP or AVIF at the right size to every browser.
3. **Writes to Atlas** with indexes, upserting on `id` so a re-run updates
   rather than duplicates. Your previous `db.json` is copied to
   `data/db.pre-migration.<timestamp>.json` first.

Then set `MONGODB_URI` in `server/.env` and restart. Boot prints which store
it is using.

### Verifying before you cancel Shopify

```bash
grep -c cdn.shopify.com server/data/db.json    # must be 0
```

Then `npm run dev`, click through shop → product → cart, and confirm images
load. Back up `data/db.pre-migration.*.json` off this machine. Only then
cancel Shopify.

---

## How storage works now

`server/db.js` picks one of three backends at boot:

| env var | store |
| --- | --- |
| `DATABASE_URL` | CockroachDB — the real store |
| `MONGODB_URI` | MongoDB Atlas — legacy, only if `DATABASE_URL` is unset |
| neither | `data/db.json` — offline dev and `npm run seed` |

`server/db.js` keeps the same synchronous interface the routes already used —
`db.products` is still a plain array — so nothing in `index.js` changed.
Underneath: every collection loads into memory at boot, and `save()` writes
back only the documents that actually differ, debounced.

### The CockroachDB schema

The app stores documents, not rows, so each collection is one table of
`(key STRING PRIMARY KEY, doc JSONB, updated_at TIMESTAMPTZ)`. `key` is the
document's own `id` — or `slug` for `categories`, which has no `id`. Nothing
is flattened into columns, so adding a field to a product needs no migration.

You can still query inside the JSON:

```sql
SELECT doc->>'name', doc->>'stock' FROM products WHERE (doc->>'stock')::INT < 5;
SELECT count(*) FROM orders WHERE doc->>'status' = 'placed';
```

CockroachDB is distributed, so any transaction can come back with a retryable
serialization error (`40001`). `server/postgres.js` wraps every read and write
in a backoff-and-retry loop; that is what the occasional `. retrying` line in
the logs is.

Writes go out as one transaction per changed collection, batched 400 rows at a
time — a full 11.7k-row `visits` rewrite would otherwise blow past the 65535
bind-parameter limit.

This suits one server instance and a few thousand documents. If you ever run
two instances behind a load balancer, they will not see each other's writes —
that is the point to move to real per-request queries.

## Payments

`POST /api/orders` handles COD. Online payments go through three steps:

1. `POST /api/payments/razorpay/order` — the **server** prices the cart from
   the catalogue and opens a Razorpay order for that amount. The browser sends
   only product ids and quantities; a client that posts `price: 1` is ignored.
   No order exists yet, just a pending intent.
2. The Razorpay widget takes the money.
3. `POST /api/payments/razorpay/verify` — the signature is checked with
   HMAC-SHA256 against your key secret, in constant time. Only then is the
   order created and stock decremented.

`POST /api/payments/razorpay/webhook` is the backstop for a customer who pays
and closes the tab. Both paths are idempotent: the callback and the webhook
can both fire and you still get exactly one order.

While Razorpay is configured, `POST /api/orders` **refuses** `payment: 'Prepaid'`
— otherwise anyone could mint a paid order by calling it directly.

Unpaid attempts live in a `payments` collection, never in `orders`, so
abandoned checkouts cannot inflate your revenue figures.

### Going live

Swap `rzp_test_*` for live keys, point the webhook at your real domain, and
put the site behind HTTPS.

---

## Admin authentication

The demo login is gone. `server/auth.js` now does the real thing:

- **Passwords** are hashed with scrypt (N=16384) and a per-account random salt,
  compared in constant time. Nothing stores a plaintext password.
- **Tokens** are HMAC-SHA256 signed, carry a 7-day expiry, and are verified on
  every request. Editing the payload breaks the signature.
- **Revocation** works through an `epoch` counter on the account. Changing the
  password bumps it, which instantly invalidates every token already issued —
  so a password change really does sign out every other device.
- **Login is throttled**: 8 failed attempts per IP+email in 15 minutes, then
  429. A wrong email and a wrong password return the same message and take the
  same time, so the endpoint cannot be used to discover valid addresses.

`AUTH_SECRET` in `server/.env` signs the tokens — changing it signs everyone
out. If it is unset, a random key is generated and stored in the database, and
`/api/settings` filters it out of both reads and writes so it can never be
served to a visitor.

### First run, and forgotten passwords

The first boot creates one admin and prints a **generated** password once —
there is no default to guess. To get back in later:

```bash
npm run admin:list                              # who can sign in
npm run admin:reset                             # new random password, printed once
npm run admin:reset -- --password 'MyOwn123Pw'  # or set a known one
```

A reset bumps `epoch`, so every existing session dies with it. This needs shell
access to the server, which is deliberately the only recovery path.

### `/api/demo/reset` was removed

It reseeded every collection from `seed.js`. Now that `admins` is a collection,
one call would have deleted the only login and locked the owner out of a live
store. Reseed against a local `db.json`, never over HTTP.

---

## Clearing the seeded demo data

The seed invents orders, bookings, traffic and star ratings to make the demo
look alive. None of it belongs in a real store:

```bash
npm run clean:demo:dry     # show what would go, write nothing
npm run clean:demo         # do it (snapshots the store first)
```

It keeps every product, category, service, banner, event and page, keeps orders
and customers that came from Shopify (`shopifyId`) or the live site
(`source: 'Website'`), recomputes each product's `sold` from the orders that
survive, and clears the invented `rating`/`reviews` counts. `admins` is
protected and never touched. The snapshot it writes first excludes `admins`, so
password hashes never land in a backup file.

## Free-tier headroom

| | Limit | You |
| --- | --- | --- |
| CockroachDB free | 10 GB storage, 50M RUs/month | ~3 MB, and far less once demo visits are dropped |
| Cloudinary | 25 credits/month | 0.13 used for the 125 catalogue images (58 MB) |

The one thing that grows without bound is `visits` — every page view appends a
record, and they all sit in memory. Prune it periodically, or move that one
collection to a direct query.

---

## Storefront, accounts and admin

### Homepage

One homepage, in the owner's order: hero carousel → offer banner → shop by
category → bestsellers → reviews → Our Story → trust cards → footer.

Every section degrades on its own, so the page is never half-empty:

| Section | When there is no content |
| --- | --- |
| Hero carousel | Falls back to a built-in static hero |
| Offer banner | Falls back to a "our promise" strip, no discount |
| Reviews | Shows an example layout, labelled as such |
| Our Story | Shows "upload a portrait" rather than a broken image |

The four alternate homepage layouts (Atelier/Boutique/Studio/Gallery) were
removed — they were a design demo, and the store now has one real homepage.
`design` still controls typography, corners and palette.

### Reviews

Public submissions land as `pending` and are invisible until an admin publishes
them. `status` cannot be set by the client. A product's star rating is derived
from its approved reviews and recomputed on every moderation action — it is
never typed in, which is why the seeded ratings had to be cleared first.

Video reviews take a **YouTube or Instagram link**, normalised to an embed URL
server-side; anything else is rejected. Videos are not hosted on Cloudinary
deliberately: 25 free credits is roughly 25 GB of bandwidth, and one popular
2-minute video would consume most of it. The embed is only loaded when a
visitor presses play.

### Customer accounts

Customers register at `/account`. Tokens are the same signed format as the
admin's but carry `aud: 'customer'`, and `verifyToken` checks the audience — so
a customer token is rejected by every admin route and vice versa. Orders placed
while signed in are bound to the account from the **token**, never from the
request body.

### Returns

A return can only be raised on a **delivered** order, within 7 days of
`deliveredAt`, and only once. Ownership is checked before eligibility, so the
endpoint cannot be used to probe the delivery state of someone else's order.
The rule lives in `returnEligibility()` — one source of truth for the API and
the UI.

### Invoicing

`GET /api/orders/:id/invoice` issues an invoice the first time it is called and
then freezes it onto the order: same number, same figures, every time.

Numbers run `SKN/<financial year>/<sequence>` on the Indian April–March year.
Catalogue prices are GST-inclusive, so tax is worked *backwards* out of the
line total rather than added on top. A sale inside Uttar Pradesh splits into
CGST + SGST; anywhere else is IGST. The rate defaults to 3% (gems and imitation
jewellery) — **confirm this with your accountant before the first filing**.

An admin, or the customer who placed the order, can fetch it; nobody else. It
prints through the browser (Save as PDF), so there is no PDF dependency.

### Page content

Policy and About copy lives in the `pages` collection and is edited under
Admin → Pages, so wording changes need no redeploy. Seeding only fills in pages
that do not exist, so an edit is never overwritten on restart.

Pages carrying `reviewed: false` are **drafts written as starting points, not
legal advice**. The server prints them at boot and the admin flags them. Saving
a page marks it reviewed.
