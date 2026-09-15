# Deploying

The site is two programs and they deploy differently.

**The storefront** (`client/`) is a pile of files — HTML, CSS, JavaScript. It goes
on Cloudflare, free, served from every Cloudflare edge location.

**The API** (`server/`) is a Node process that has to stay running: it holds the
catalogue in memory, signs login tokens, talks to CockroachDB and takes Razorpay
payments. Cloudflare Workers cannot run it — see [Why the API is not on
Cloudflare](#why-the-api-is-not-on-cloudflare) at the bottom — so it goes on a
host that rents you a real Node process.

Cloudflare still sits in front of both. `client/worker.js` serves the storefront
and quietly forwards anything under `/api/` or `/uploads/` to the API, so the
whole thing answers on one domain and the browser never makes a cross-origin
request.

---

## 1. Deploy the API first

The storefront needs the API's address, so this comes first.

Railway and Render both work. Railway is used below; Render is the same shape.

1. **New Project → Deploy from GitHub repo →** `empireproperties/Sukoon_Crystal`.
2. **Root directory:** `server`
3. **Start command:** `npm start`
4. **Add the environment variables** in the table below.
5. Deploy, then copy the public URL it gives you — something like
   `https://sukoon-api.up.railway.app`. Check `https://<that-url>/api/products`
   returns JSON before going on.

> On Render, do not use the free instance type for the API. It sleeps after
> inactivity and the next shopper waits ~30 seconds for it to wake.

### Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | CockroachDB connection string. Cockroach Cloud → Connect → General connection string. URL-encode the password: `@` becomes `%40`. Without this the server falls back to a local JSON file that a redeploy erases. |
| `AUTH_SECRET` | **Yes** | Any random string, 32+ characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `CLOUDINARY_URL` | **Yes** | From the Cloudinary dashboard. Without it, admin image uploads are written to the container's disk and disappear on the next deploy. |
| `RAZORPAY_KEY_ID` | For payments | Razorpay → Settings → API Keys. |
| `RAZORPAY_KEY_SECRET` | For payments | Same page. |
| `RAZORPAY_WEBHOOK_SECRET` | For payments | Set in step 3 below. |
| `FREE_ASTRO_API_KEY` | For birth charts | freeastroapi.com → Dashboard → Keys. |
| `SITE_URL` | For SEO | The address **visitors** use — the Cloudflare Worker URL or your custom domain, not this API's own URL. Canonical tags and the sitemap are built from it. |
| `R2_ACCOUNT_ID` | For review videos | Cloudflare → R2 → the bucket's S3 API endpoint; it is the hash before `.r2.cloudflarestorage.com`. |
| `R2_ACCESS_KEY_ID` | For review videos | R2 → Manage API tokens → Create (Object Read & Write, scoped to the bucket). |
| `R2_SECRET_ACCESS_KEY` | For review videos | Same screen. Shown once. |
| `R2_BUCKET` | For review videos | The bucket name, e.g. `sukoon-crystal`. |
| `R2_PUBLIC_BASE` | For review videos | The bucket's public address, no trailing slash. R2 → Public Development URL, or a custom domain. |
| `R2_PREFIX` | No | Folder inside the bucket. Defaults to `reviews`. |
| `PORT` | No | The host sets this itself. |

All five `R2_*` credentials are needed together. Miss one and the server falls
back to Cloudinary for video, which works but meters bandwidth.

### Faster: deploy from the blueprint

[`render.yaml`](render.yaml) declares the service and every variable above. On
Render pick **New → Blueprint**, point it at this repo, and it prompts for each
secret instead of you filling in a form from memory. The blueprint ships with
`plan: free`; change that one line to `starter` before real traffic, because a
free instance sleeps after ~15 minutes and the next shopper waits ~30 seconds.

**`AUTH_SECRET` is the one people forget.** Leave it out and the server generates
a random secret at startup ([`server/auth.js`](server/auth.js)). Every restart
then invalidates every login token — customers and admins all get signed out,
seemingly at random.

---

## 2. Deploy the storefront to Cloudflare

Two ways. Pick one.

### Option 1 — connect GitHub (deploys on every push)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Workers** →
   **Import a repository**.
2. Pick `empireproperties/Sukoon_Crystal`.
3. Set:
   - **Root directory:** `client` — not the repository root, and not `server`.
     Cloudflare runs the build from inside this folder, so pointing it at
     `server` fails with `npm error Missing script: "build"`: the API has no
     build step, only the storefront does.
   - **Build command:** `npm run build` — Cloudflare runs `npm clean-install`
     itself beforehand, so there is no need to add `npm ci` here.
   - **Deploy command:** `npx wrangler deploy`
4. Create it. The first build will succeed but the shop will be empty — the API
   address is not set yet. That is step 3.

The API is **not** deployed from Cloudflare. It goes on the Node host in step 1,
and this Worker forwards to it.

### Option 2 — deploy from this machine

```bash
cd client
npx wrangler login      # once
npm run deploy          # builds, then uploads
```

---

## 3. Point the storefront at the API

In the Cloudflare dashboard: **Workers & Pages → sukoon-crystal → Settings →
Variables and Secrets → Add variable**:

| Name | Value |
| --- | --- |
| `API_ORIGIN` | The API URL from step 1, no trailing slash. e.g. `https://sukoon-api.up.railway.app` |

Save and **redeploy** — variables only take effect on the next deployment.

**`API_ORIGIN` is now set in `client/wrangler.jsonc`** (currently
`https://sukoon-crystal.onrender.com`), and that file wins: `wrangler deploy`
uploads its `vars` on every deploy, over whatever the dashboard says. That is
why an empty value there used to blank the shop on every push. If the API
moves, change it in that file and push — editing it only in the dashboard will
be undone by the next deploy. `"keep_vars": true` stops a deploy from deleting
any other variable added in the dashboard.

Then check: open the Worker's URL. Products should load. If you see
`{"error":"API_ORIGIN is not configured on this Worker."}` on any `/api/` call,
the variable did not save or the Worker was not redeployed.

---

## 4. Custom domain

**Workers & Pages → sukoon-crystal → Settings → Domains & Routes → Add custom
domain.** Cloudflare creates the DNS record itself if the domain is already on
your account. TLS is automatic.

Leave the API on its host's own URL — it is reached through the Worker, so it
never needs a domain of its own.

---

## 5. Razorpay webhook

Razorpay → **Settings → Webhooks → Add New Webhook**:

- **URL:** `https://<your-domain>/api/payments/razorpay/webhook`
- **Active events:** `payment.captured`
- **Secret:** the same string you put in `RAZORPAY_WEBHOOK_SECRET`

Use the Cloudflare domain, not the API host's URL — the Worker forwards the
request body through unchanged, which the signature check depends on.

Until this is set, payments will be taken and orders will not be marked paid.

---

## Deploying again, later

- **Storefront:** push to `main` (option 1), or `cd client && npm run deploy`.
- **API:** push to `main`; Railway and Render both redeploy on push.

Neither touches the database.

---

## Why the API is not on Cloudflare

Cloudflare Workers are not Node servers. Each request may reach a fresh copy of
the code with no memory of the last one, no filesystem, no background timers,
and only part of Node's standard library. Four things in this codebase depend on
exactly those:

1. **[`server/db.js`](server/db.js) holds the whole dataset in memory** and writes
   changes back on a debounce. On Workers, every request would re-read ~3 MB from
   CockroachDB, and two simultaneous orders would each write back their own copy
   of the data — one silently overwriting the other. That is data loss, not
   slowness.
2. **Passwords are hashed with `scrypt`** ([`server/auth.js`](server/auth.js)),
   which Workers' crypto does not implement. Nobody could log in until every
   stored hash was migrated to a different algorithm.
3. **A `setInterval` sweeps failed logins.** Workers have nothing alive to run it.
4. **Uploads use multer and the local disk.** Workers have no disk.

Moving to Workers means rewriting the storage layer to query per request through
Hyperdrive, migrating every password hash, and sending uploads straight to
Cloudinary. Worth doing if the hosting bill ever justifies it. Not worth doing
before the shop has taken its first order.

**Cloudflare Containers** is the middle road: it runs a real container, so the
Express app works unchanged and everything stays on Cloudflare. It needs a
Dockerfile and it bills for container time rather than per request — check the
current pricing against your traffic before switching.
