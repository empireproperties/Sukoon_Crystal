const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  await p.addInitScript(() => {
    const qs = new URLSearchParams(location.search); const d = qs.get('__d'), pa = qs.get('__p');
    if (!d) return; const o = window.fetch;
    window.fetch = async (...a) => { const r = await o(...a);
      if (String(a[0]).includes('/api/settings')) { try { const j = await r.clone().json(); j.design = d; j.palette = pa;
        return new Response(JSON.stringify(j), { headers: { 'content-type': 'application/json' } }); } catch {} } return r; };
  });
  await p.goto('http://localhost:5173/?__d=gallery&__p=obsidian-gold', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('h1'); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    const sec = h1.closest('section');
    const rows = [];
    let el = sec;
    // everything preceding the hero section in document order
    let n = document.body;
    const walk = (node, depth) => {
      if (depth > 4) return;
      for (const c of node.children) {
        const r = c.getBoundingClientRect();
        if (r.height > 300) rows.push({ tag: c.tagName, cls: c.className.toString().slice(0, 70), top: Math.round(r.top), h: Math.round(r.height), pos: getComputedStyle(c).position });
        walk(c, depth + 1);
      }
    };
    walk(document.body, 0);
    const img = sec.querySelector('img');
    return {
      heroTop: Math.round(sec.getBoundingClientRect().top),
      heroH: Math.round(sec.getBoundingClientRect().height),
      heroImgWrapper: (() => { const w = img?.parentElement; const r = w?.getBoundingClientRect(); return w ? { cls: w.className.slice(0,90), pos: getComputedStyle(w).position, h: Math.round(r.height) } : null; })(),
      big: rows.slice(0, 8),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})();
