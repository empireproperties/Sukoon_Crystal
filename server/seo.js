/* Everything a crawler needs, computed server-side.
 *
 * WHY THIS EXISTS
 * The storefront is a single-page React app. What the CDN actually serves for
 * every URL is one index.html containing an empty <div id="root">, and the page
 * only becomes real once the browser has downloaded and run the bundle.
 *
 * Google will run that bundle, eventually, on a second pass it schedules when
 * it feels like it. Almost nothing else will. The crawlers that feed AI answers
 * -- GPTBot, ClaudeBot, PerplexityBot, Bingbot's older paths -- read the HTML
 * they are handed and stop. Handed an empty div, they conclude the site is
 * empty, and the shop is invisible to exactly the systems people increasingly
 * ask "where do I buy real rudraksha".
 *
 * So the Worker asks this module what a given URL is about and splices the
 * answer into the shell before it goes out: a real <title>, a real description,
 * the canonical, Open Graph, JSON-LD, and a plain-HTML rendering of the page's
 * substance inside #root. React overwrites that div on hydration, so a human
 * never sees it and it cannot drift from what the page shows -- it is generated
 * from the same database rows the components render.
 *
 * All of it lives here rather than in the Worker on purpose: this is ordinary
 * Node that can be run and tested directly, and there is one copy of the rules.
 */
import { db } from './db.js';

/* The public address of the storefront. Absolute URLs are not optional in
   structured data or in og:image -- a crawler has no base to resolve against. */
export const siteUrl = () =>
  (process.env.SITE_URL || 'https://sukoon-crystalsolutions.com').replace(/\/+$/, '');

const abs = (p) => (/^https?:\/\//i.test(p || '') ? p : `${siteUrl()}${p || '/'}`);

/* ------------------------------------------------------------------ escaping */
/* Two different escapes, and mixing them up is how you get an XSS.
   `esc` is for text that lands in HTML or an attribute.
   `jsonLd` is for a <script> body, where the danger is not `<` but the exact
   sequence `</script` closing the block early. */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const jsonLd = (obj) => JSON.stringify(obj)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** Collapses markup and whitespace, then cuts on a word boundary. Meta
 *  descriptions are truncated by the search engine at roughly 160 characters,
 *  and a sentence cut mid-word looks like a broken site. */
function summarise(text, max = 155) {
  const clean = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
}

const settings = () => db.settings || {};
const siteName = () => settings().siteName || 'Sukoon Crystal Solutions';

const activeProducts = () => (db.products || []).filter((p) => p.active !== false);
const categories = () => db.categories || [];

/* ---------------------------------------------------------------- ratings -- */
/**
 * Stars for structured data, counted from reviews this site actually published.
 *
 * Deliberately NOT `product.rating` / `product.reviews`. Those two fields came
 * across in the Shopify import and count reviews that were left somewhere else;
 * putting them in an AggregateRating claims to Google that this page carries
 * that many reviews, which it does not, and that is the specific thing manual
 * actions are handed out for. A product with no approved review here gets no
 * rating markup at all, which costs a star in the results and keeps the site.
 */
function ratingFor(productId) {
  const mine = (db.reviews || []).filter((r) => r.productId === productId && r.status === 'approved');
  if (!mine.length) return null;
  const avg = mine.reduce((s, r) => s + (r.rating || 0), 0) / mine.length;
  return { ratingValue: Math.round(avg * 10) / 10, reviewCount: mine.length };
}

/* ------------------------------------------------------------ shared nodes -- */

/** The shop as an entity. Emitted on every page: it is what ties reviews,
 *  the phone number and the Instagram account to one business rather than to
 *  whichever URL happened to be crawled first. */
function organisation() {
  const s = settings();
  const sameAs = [s.instagram, s.facebook].filter(Boolean);

  return {
    '@type': ['Store', 'HealthAndBeautyBusiness'],
    '@id': `${siteUrl()}/#organisation`,
    name: siteName(),
    description: 'Certified astrologer-led crystal studio. Genuine gemstone bracelets, '
      + 'zodiac stones and authentic rudraksha, chosen from your birth chart and energised before dispatch.',
    url: siteUrl(),
    ...(s.logo ? { logo: abs(s.logo), image: abs(s.logo) } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.address ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.address,
        addressLocality: 'Meerut',
        addressRegion: 'Uttar Pradesh',
        addressCountry: 'IN',
      },
    } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    priceRange: '₹₹',
    currenciesAccepted: 'INR',
    areaServed: { '@type': 'Country', name: 'India' },
  };
}

/** Lets Google offer a search box for the site in its own results, and tells
 *  every crawler which name this domain answers to. */
function website() {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl()}/#website`,
    url: siteUrl(),
    name: siteName(),
    alternateName: ['Sukoon', 'Sukoon Crystals', 'Sukoon CrystalSolutions'],
    publisher: { '@id': `${siteUrl()}/#organisation` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl()}/shop?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

const breadcrumbs = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: t.name,
    item: abs(t.path),
  })),
});

/* ------------------------------------------------------------ page builders */

const productNode = (p) => {
  const rating = ratingFor(p.id);
  const inStock = p.stock > 0;

  return {
    '@type': 'Product',
    '@id': `${siteUrl()}/product/${p.slug}#product`,
    name: p.name,
    description: summarise(p.description || (p.benefits || []).join('. '), 300),
    ...(p.images?.length ? { image: p.images.slice(0, 5).map(abs) } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    brand: { '@type': 'Brand', name: siteName() },
    ...(p.stone ? {
      material: p.stone,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Stone', value: p.stone },
        ...(p.chakra ? [{ '@type': 'PropertyValue', name: 'Chakra', value: p.chakra }] : []),
        ...(p.element ? [{ '@type': 'PropertyValue', name: 'Element', value: p.element }] : []),
        ...((p.zodiac || []).length ? [{ '@type': 'PropertyValue', name: 'Zodiac', value: p.zodiac.join(', ') }] : []),
      ],
    } : {}),
    offers: {
      '@type': 'Offer',
      url: `${siteUrl()}/product/${p.slug}`,
      priceCurrency: 'INR',
      price: String(p.price),
      availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${siteUrl()}/#organisation` },
    },
    ...(rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: String(rating.ratingValue),
        reviewCount: String(rating.reviewCount),
        bestRating: '5',
        worstRating: '1',
      },
    } : {}),
  };
};

/* The crawlable body. Not a duplicate of the React tree -- a summary of the
   same rows, in the order a reader would want them, with real links so a
   crawler that never runs the bundle can still walk the whole catalogue. */
const productBody = (p) => {
  const rating = ratingFor(p.id);
  return `
    <article>
      <h1>${esc(p.name)}</h1>
      <p>${esc(summarise(p.description, 400))}</p>
      <p><strong>₹${esc(p.price)}</strong>${p.mrp > p.price ? ` <s>₹${esc(p.mrp)}</s>` : ''}
         — ${p.stock > 0 ? 'in stock' : 'out of stock'}</p>
      ${p.stone ? `<p>Stone: ${esc(p.stone)}</p>` : ''}
      ${p.chakra ? `<p>Chakra: ${esc(p.chakra)}</p>` : ''}
      ${(p.zodiac || []).length ? `<p>Zodiac: ${esc(p.zodiac.join(', '))}</p>` : ''}
      ${rating ? `<p>Rated ${rating.ratingValue} out of 5 from ${rating.reviewCount} review(s).</p>` : ''}
      ${(p.benefits || []).length
        ? `<h2>What it helps with</h2><ul>${p.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
        : ''}
      ${p.images?.[0] ? `<img src="${esc(abs(p.images[0]))}" alt="${esc(p.name)}" width="600" />` : ''}
    </article>`;
};

const listBody = (heading, blurb, items) => `
    <section>
      <h1>${esc(heading)}</h1>
      ${blurb ? `<p>${esc(blurb)}</p>` : ''}
      <ul>${items.map((p) => `<li><a href="${esc(abs(`/product/${p.slug}`))}">${esc(p.name)}</a>
        — ₹${esc(p.price)}${p.stone ? ` · ${esc(p.stone)}` : ''}</li>`).join('')}</ul>
    </section>`;

/* Static routes. The copy is the pitch a search result should carry, which is
   not always the copy on the page -- a description is an advert, a heading is
   a label. */
const STATIC_PAGES = {
  '/': {
    title: () => `${siteName()} | Certified Astrologer-Chosen Crystals & Rudraksha`,
    description: () => 'Genuine crystal bracelets, zodiac gemstones and authentic rudraksha, '
      + 'chosen for you from your birth chart by certified astrologer Swati Khanna. Energised before '
      + 'dispatch. Free shipping across India above ₹600, cash on delivery.',
  },
  '/shop': {
    title: () => `Shop Crystals, Zodiac Bracelets & Rudraksha | ${siteName()}`,
    description: () => 'Every piece in the Sukoon collection: wellness bracelets, zodiac stones, '
      + 'authentic rudraksha and charging rituals. Genuine stones, energised in our Meerut studio.',
  },
  '/about': {
    title: () => `About Swati Khanna, Certified Astrologer | ${siteName()}`,
    description: () => 'Sukoon Crystal Solutions is led by Swati Khanna, a certified astrologer and '
      + 'numerologist with over ten years of practice in Meerut. How we choose, source and energise every stone.',
  },
  '/contact': {
    title: () => `Contact ${siteName()} | Meerut Crystal & Astrology Studio`,
    description: () => 'Talk to the Sukoon studio in Meerut about a stone, an order or a reading. '
      + 'Phone, WhatsApp, email and studio address.',
  },
  '/book': {
    title: () => `Book an Astrology Consultation | ${siteName()}`,
    description: () => 'Book a consultation with certified astrologer Swati Khanna. A free fifteen-minute '
      + 'call to find which stones your chart actually asks for.',
  },
  '/birth-chart': {
    title: () => `Free Vedic Birth Chart & Kundli | ${siteName()}`,
    description: () => 'Generate your free Vedic birth chart. See your rising sign, moon sign and planetary '
      + 'placements, with the gemstones traditionally recommended for them.',
  },
  '/calendar': {
    title: () => `Auspicious Dates & Crystal Rituals Calendar | ${siteName()}`,
    description: () => 'Full moons, festivals and muhurat windows, with the cleansing and charging ritual '
      + 'suited to each.',
  },
  '/track': {
    title: () => `Track Your Order | ${siteName()}`,
    description: () => 'Follow a Sukoon order from our Meerut studio to your door.',
    robots: 'noindex, follow',
  },
  '/checkout': { title: () => `Checkout | ${siteName()}`, robots: 'noindex, nofollow' },
  '/account': { title: () => `Your Account | ${siteName()}`, robots: 'noindex, nofollow' },
};

/* Policy pages are real content the store is judged on -- a shipping and refund
   policy is one of the trust signals both Google and an AI answer look for --
   so they are indexed rather than hidden. */
const POLICY_TITLES = {
  'privacy-policy': 'Privacy Policy',
  'terms-of-service': 'Terms of Service',
  'shipping-policy': 'Shipping Policy',
  'return-refund-policy': 'Return & Refund Policy',
  faq: 'Frequently Asked Questions',
};

/** A stored page's sections, flattened to `{ heading, text }`.
 *
 *  Pages are written in content.js as `{ heading, body: [paragraph, ...], list }`
 *  and edited from Admin > Pages afterwards, so both shapes have to survive. */
function sectionsOf(page) {
  return (page?.sections || []).map((section) => {
    const parts = [
      ...(Array.isArray(section.body) ? section.body : [section.body]),
      ...(Array.isArray(section.list) ? section.list : []),
    ].filter(Boolean).map(String);
    return { heading: String(section.heading || ''), text: parts.join(' ') };
  }).filter((x) => x.heading || x.text);
}

/** The Q&A pairs behind FAQPage markup -- the one schema that still earns a
 *  block of extra space in a result, and the shape an AI assistant quotes back
 *  most readily when asked "are Sukoon's stones real".
 *
 *  A section counts as a question when its heading reads as one. That is a
 *  looser rule than matching a dedicated field, but the FAQ page genuinely is
 *  stored as headings and paragraphs, and marking a shipping timetable as a
 *  Question would be the worse error. */
function faqPairs(page) {
  return sectionsOf(page)
    .filter((x) => /\?\s*$/.test(x.heading) && x.text)
    .map((x) => ({ q: x.heading, a: x.text }));
}

/* ------------------------------------------------------------------ router */

/**
 * Everything the Worker needs for one URL.
 *
 * Always returns a usable object. An unknown path gets the site defaults and
 * `noindex`, because a 404 that returns 200 with real metadata is how a site
 * ends up with thousands of junk URLs in an index.
 */
export function seoForPath(rawPath) {
  const path = `/${String(rawPath || '/').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '/');
  const home = { name: 'Home', path: '/' };

  const base = {
    path,
    canonical: abs(path),
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    image: settings().logo ? abs(settings().logo) : `${siteUrl()}/og-default.jpg`,
    type: 'website',
    graph: [organisation(), website()],
    body: '',
  };

  /* ---- product ---- */
  const product = path.startsWith('/product/')
    && activeProducts().find((p) => p.slug === path.slice('/product/'.length));

  if (product) {
    const cat = categories().find((c) => c.slug === product.category);
    return {
      ...base,
      title: `${product.name} | ${siteName()}`,
      description: summarise(product.description
        || `${product.name} — ${product.stone || 'genuine crystal'}, energised before dispatch by Sukoon Crystal Solutions.`),
      image: product.images?.[0] ? abs(product.images[0]) : base.image,
      type: 'product',
      graph: [
        ...base.graph,
        productNode(product),
        breadcrumbs([
          home,
          { name: 'Shop', path: '/shop' },
          ...(cat ? [{ name: cat.name, path: `/shop/${cat.slug}` }] : []),
          { name: product.name, path },
        ]),
      ],
      body: productBody(product),
    };
  }

  /* A /product/ URL with no matching row: the piece was delisted or the link is
     wrong. Never index it, and never let it look like a real page. */
  if (path.startsWith('/product/')) {
    return { ...base, title: `Not found | ${siteName()}`, description: '', robots: 'noindex, follow' };
  }

  /* ---- category ---- */
  const cat = path.startsWith('/shop/') && categories().find((c) => c.slug === path.slice('/shop/'.length));
  if (cat) {
    const items = activeProducts().filter((p) => p.category === cat.slug);
    return {
      ...base,
      title: `${cat.name} | ${siteName()}`,
      description: summarise(`${cat.tagline || cat.name} — ${items.length} genuine, energised `
        + `${cat.name.toLowerCase()} from Sukoon Crystal Solutions, chosen by a certified astrologer.`),
      graph: [
        ...base.graph,
        {
          '@type': 'ItemList',
          name: cat.name,
          numberOfItems: items.length,
          itemListElement: items.slice(0, 40).map((p, i) => ({
            '@type': 'ListItem', position: i + 1, url: `${siteUrl()}/product/${p.slug}`, name: p.name,
          })),
        },
        breadcrumbs([home, { name: 'Shop', path: '/shop' }, { name: cat.name, path }]),
      ],
      body: listBody(cat.name, cat.tagline, items),
    };
  }

  if (path.startsWith('/shop/')) {
    return { ...base, title: `Not found | ${siteName()}`, description: '', robots: 'noindex, follow' };
  }

  /* ---- policy pages, FAQ included ---- */
  const handle = path.slice(1);
  if (POLICY_TITLES[handle]) {
    const page = (db.pages || []).find((p) => p.handle === handle);
    const pairs = handle === 'faq' ? faqPairs(page) : [];

    return {
      ...base,
      title: `${POLICY_TITLES[handle]} | ${siteName()}`,
      description: summarise(page?.summary || page?.excerpt
        || sectionsOf(page)[0]?.text
        || `${POLICY_TITLES[handle]} for ${siteName()}.`),
      graph: [
        ...base.graph,
        ...(pairs.length ? [{
          '@type': 'FAQPage',
          mainEntity: pairs.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: summarise(a, 900) },
          })),
        }] : []),
        breadcrumbs([home, { name: POLICY_TITLES[handle], path }]),
      ],
      body: `<section><h1>${esc(POLICY_TITLES[handle])}</h1>${
        sectionsOf(page).map(({ heading, text }) =>
          `${heading ? `<h2>${esc(heading)}</h2>` : ''}${text ? `<p>${esc(summarise(text, 900))}</p>` : ''}`
        ).join('')
      }</section>`,
    };
  }

  /* ---- static ---- */
  const stat = STATIC_PAGES[path];
  if (stat) {
    const extra = [];
    let body = '';

    if (path === '/') {
      const featured = activeProducts().filter((p) => p.featured).slice(0, 12);
      body = `
        <section>
          <h1>${esc(siteName())} — crystals and rudraksha chosen from your birth chart</h1>
          <p>${esc(stat.description())}</p>
          <h2>Shop by category</h2>
          <ul>${categories().map((c) => `<li><a href="${esc(abs(`/shop/${c.slug}`))}">${esc(c.name)}</a>${
            c.tagline ? ` — ${esc(c.tagline)}` : ''}</li>`).join('')}</ul>
          ${featured.length ? listBody('Bestsellers', '', featured) : ''}
        </section>`;
    } else if (path === '/shop') {
      const all = activeProducts();
      extra.push({
        '@type': 'ItemList',
        numberOfItems: all.length,
        itemListElement: all.slice(0, 60).map((p, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${siteUrl()}/product/${p.slug}`, name: p.name,
        })),
      });
      body = listBody('Shop all crystals, bracelets and rudraksha', stat.description(), all);
    } else if (path === '/contact' || path === '/about') {
      body = `<section><h1>${esc(stat.title())}</h1><p>${esc(stat.description())}</p></section>`;
    }

    return {
      ...base,
      title: stat.title(),
      description: stat.description ? summarise(stat.description(), 300) : '',
      robots: stat.robots || base.robots,
      graph: [...base.graph, ...extra,
        ...(path === '/' ? [] : [breadcrumbs([home, { name: stat.title().split('|')[0].trim(), path }])])],
      body,
    };
  }

  return { ...base, title: `Page not found | ${siteName()}`, description: '', robots: 'noindex, follow' };
}

/* ------------------------------------------------------------------- <head> */

/**
 * The head fragment, as a string, ready to splice in. Built here rather than in
 * the Worker so the escaping rules live next to the data they protect.
 */
export function headTagsFor(seo) {
  const s = settings();
  const tags = [
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    `<meta name="robots" content="${esc(seo.robots)}" />`,

    `<meta property="og:type" content="${esc(seo.type)}" />`,
    `<meta property="og:site_name" content="${esc(siteName())}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    `<meta property="og:image" content="${esc(seo.image)}" />`,
    `<meta property="og:locale" content="en_IN" />`,

    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${esc(seo.image)}" />`,

    /* Geography. A studio in Meerut competing on "crystal shop near me" needs
       to say where it is in a form a machine can read. */
    `<meta name="geo.region" content="IN-UP" />`,
    `<meta name="geo.placename" content="Meerut" />`,
    ...(s.address ? [`<meta name="geo.position" content="28.9845;77.7064" />`] : []),

    `<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': seo.graph })}</script>`,
  ];
  return tags.join('\n    ');
}

/* ------------------------------------------------------------------ sitemap */

/** Every URL worth crawling, newest products first. `lastmod` is real: a stale
 *  date on every row teaches a crawler to ignore the field. */
export function sitemapXml() {
  const now = new Date().toISOString();
  const rows = [
    { loc: '/', priority: '1.0', changefreq: 'daily', lastmod: now },
    { loc: '/shop', priority: '0.9', changefreq: 'daily', lastmod: now },
    ...categories().map((c) => ({
      loc: `/shop/${c.slug}`, priority: '0.8', changefreq: 'weekly', lastmod: now,
    })),
    ...activeProducts().map((p) => ({
      loc: `/product/${p.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: new Date(p.updatedAt || p.createdAt || p.published || now).toISOString(),
    })),
    { loc: '/about', priority: '0.7', changefreq: 'monthly', lastmod: now },
    { loc: '/book', priority: '0.7', changefreq: 'monthly', lastmod: now },
    { loc: '/birth-chart', priority: '0.7', changefreq: 'monthly', lastmod: now },
    { loc: '/contact', priority: '0.6', changefreq: 'monthly', lastmod: now },
    { loc: '/calendar', priority: '0.5', changefreq: 'weekly', lastmod: now },
    ...Object.keys(POLICY_TITLES).map((h) => ({
      loc: `/${h}`, priority: h === 'faq' ? '0.6' : '0.3', changefreq: 'yearly', lastmod: now,
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map((r) => `  <url>
    <loc>${esc(abs(r.loc))}</loc>
    <lastmod>${esc(r.lastmod)}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

/* ---------------------------------------------------------------- robots.txt */

/* The AI crawlers, named explicitly.
 *
 * A bare "User-agent: *  Allow: /" already permits all of them, so why list
 * them? Because several of these read a site's file looking for their own name
 * before falling back to the wildcard, and because being explicit is a decision
 * that survives someone later tightening the wildcard. A shop that wants to be
 * the answer to "where do I buy authentic rudraksha" has to be readable by the
 * things answering that question.
 *
 * Google-Extended is the one that is genuinely separate: it governs whether
 * pages may inform Gemini and AI Overviews, and it is opt-out, so leaving it
 * allowed is a real choice rather than a no-op. */
const AI_AGENTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',        /* OpenAI */
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot',   /* Anthropic */
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended',                                /* Gemini and AI Overviews */
  'Applebot-Extended',
  'CCBot',                                          /* Common Crawl, feeds many models */
  'meta-externalagent',
  'Bingbot', 'DuckDuckBot',
];

/* Nothing here is secret -- the API refuses an unauthenticated admin request on
   its own. These are excluded because they are worthless in an index: a
   checkout is different for every visitor, and a crawler wandering into
   /account produces thin duplicate pages that dilute the pages that matter. */
const DISALLOWED = ['/admin', '/admin/', '/checkout', '/account', '/track?', '/api/'];

export function robotsTxt() {
  const block = (agent) => [
    `User-agent: ${agent}`,
    ...DISALLOWED.map((d) => `Disallow: ${d}`),
    'Allow: /',
    '',
  ].join('\n');

  return [
    `# ${siteName()}`,
    '# Crawlers are welcome. The shop wants to be findable, by search engines',
    '# and by the assistants people now ask for recommendations.',
    '',
    block('*'),
    ...AI_AGENTS.map(block),
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    '',
  ].join('\n');
}
