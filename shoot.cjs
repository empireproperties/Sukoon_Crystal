/* Renders each design/palette pair and reports any runtime errors. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5173';
const OUT = process.argv[2] || path.join(__dirname, 'shots');
const ONLY = process.argv[3];

const COMBOS = [
  ['atelier', ['bone', 'clay', 'sage', 'ink', 'slate']],
  ['boutique', ['ivory-emerald', 'champagne-burgundy', 'pearl-navy', 'forest-gold', 'wine-champagne']],
  ['studio', ['sand-charcoal', 'paper-cobalt', 'chalk-forest', 'graphite-amber', 'midnight-mint']],
  ['gallery', ['alabaster-gold', 'mist-rose', 'linen-jade', 'obsidian-gold', 'espresso-cream']],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const problems = [];

  page.on('pageerror', (e) => problems.push(`PAGEERROR ${page.url()} :: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|ERR_|net::/i.test(m.text())) {
      problems.push(`CONSOLE ${page.url()} :: ${m.text().slice(0, 200)}`);
    }
  });

  /* One init script for the whole run: the design/palette comes from the URL,
     and the settings response is rewritten so the app adopts it. */
  await page.addInitScript(() => {
    const qs = new URLSearchParams(location.search);
    const d = qs.get('__d');
    const p = qs.get('__p');
    if (!d) return;
    const orig = window.fetch;
    window.fetch = async (...a) => {
      const res = await orig(...a);
      if (String(a[0]).includes('/api/settings')) {
        try {
          const j = await res.clone().json();
          j.design = d;
          j.palette = p;
          return new Response(JSON.stringify(j), { headers: { 'content-type': 'application/json' } });
        } catch { /* fall through */ }
      }
      return res;
    };
  });

  const visit = async (url, file, waitFor) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 20000 }).catch(() => {});
    /* Let fonts settle and lazy images decode, without waiting on the CDN. */
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(1400);
    await page.screenshot({ path: file, timeout: 60000, animations: 'disabled', caret: 'hide' });
    console.log('shot', path.basename(file));
  };

  for (const [design, palettes] of COMBOS) {
    if (ONLY && ONLY !== design) continue;
    for (const palette of palettes) {
      await visit(
        `${BASE}/?__d=${design}&__p=${palette}`,
        path.join(OUT, `home-${design}-${palette}.png`),
        'h1'
      );
    }
  }

  if (!ONLY) {
    const PAGES = [
      ['shop', '/shop', 'h1'],
      ['product', '/product/sphtik-bracelet', 'h1'],
      ['book', '/book', 'h1'],
      ['admin-login', '/admin/login', 'form'],
    ];
    for (const [name, url, sel] of PAGES) {
      await visit(`${BASE}${url}?__d=atelier&__p=bone`, path.join(OUT, `page-${name}.png`), sel);
    }
  }

  await browser.close();

  const unique = [...new Set(problems)];
  if (unique.length) {
    console.log('\n--- PROBLEMS ---');
    unique.slice(0, 30).forEach((p) => console.log(p));
  } else {
    console.log('\nNo runtime errors.');
  }
})();
