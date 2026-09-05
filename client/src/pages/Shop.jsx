import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal, X, Search, ChevronRight, ChevronDown, Check } from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useAsync } from '../lib/store.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Stagger } from '../components/Motion.jsx';
import { ZODIAC, CHAKRAS, ChakraDot } from '../components/Ornaments.jsx';


/* Column count is the real control over how tall a card is: the photo is
   square, so a card in a two-up grid on a 1000px column is 500px of image
   before the name. Three from the tablet up, four once the window can hold
   them, which keeps the tile roughly a screen-third tall at every width. */
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4';

const CATEGORIES = [
  { slug: 'all', name: 'All products' },
  { slug: 'wellness-bracelets', name: 'Wellness Bracelets' },
  { slug: 'zodiac-bracelets', name: 'Zodiac Bracelets' },
  { slug: 'rudraksha', name: 'Rudraksha' },
  { slug: 'sukoon-special', name: 'Sukoon Special' },
];

const SORTS = [
  { id: 'popular', label: 'Most popular' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating', label: 'Customer rating' },
];

const PRICE_BANDS = [
  { id: '', label: 'Any price' },
  { id: '600', label: 'Under ₹600' },
  { id: '1000', label: 'Under ₹1,000' },
  { id: '1500', label: 'Under ₹1,500' },
  { id: '2500', label: 'Under ₹2,500' },
];

const HEADINGS = {
  all: { title: 'All products', sub: 'Every crystal, bracelet and ritual piece we make, energised before dispatch.' },
  'wellness-bracelets': { title: 'Wellness Bracelets', sub: 'For money, protection, sleep, temper and focus — chosen for what is actually weighing on you.' },
  'zodiac-bracelets': { title: 'Zodiac Bracelets', sub: 'Twelve signs, each with a stone pairing chosen for what that sign already leans towards.' },
  rudraksha: { title: 'Rudraksha', sub: 'Authentic beads and malas, energised with the Mahamrityunjaya mantra before they are packed.' },
  'sukoon-special': { title: 'Sukoon Special', sub: 'Selenite charging plates, crystal trees, bath salts and everything for the ritual around the stone.' },
};

/* ------------------------------------------------------------ filter body */
function Filters({ zodiac, chakra, maxPrice, q, setParam, clearAll, activeCount }) {
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  return (
    <div className="space-y-7">
      <div>
        <label className="field-label">Search</label>
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', search); }} className="relative">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="amethyst, protection…" className="field !pl-9" />
        </form>
      </div>

      <div>
        <p className="field-label">Price</p>
        <ul className="space-y-1.5">
          {PRICE_BANDS.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => setParam('max', b.id)}
                className={`flex w-full items-center gap-2.5 py-1 text-left text-[0.85rem] transition-colors ${
                  (maxPrice || '') === b.id ? 'text-brand' : 'text-ink hover:text-brand'
                }`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  (maxPrice || '') === b.id ? 'border-brand bg-brand text-white' : 'border-line'
                }`}>
                  {(maxPrice || '') === b.id && <Check size={9} strokeWidth={3.5} />}
                </span>
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="field-label">Zodiac sign</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setParam('zodiac', 'all')}
            className={`border px-2.5 py-1.5 text-[0.75rem] transition-colors ${
              zodiac === 'all' ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
            }`}
            style={{ borderRadius: 'var(--r-btn)' }}
          >
            Any
          </button>
          {ZODIAC.map((z) => (
            <button
              key={z.id}
              onClick={() => setParam('zodiac', z.id)}
              title={z.name}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[0.75rem] transition-colors ${
                zodiac === z.id ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
              }`}
              style={{ borderRadius: 'var(--r-btn)' }}
            >
              <span className="text-accent">{z.glyph}</span> {z.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="field-label">Chakra</p>
        <ul className="space-y-1.5">
          <li>
            <button
              onClick={() => setParam('chakra', 'all')}
              className={`text-[0.85rem] transition-colors ${chakra === 'all' ? 'text-brand' : 'text-ink hover:text-brand'}`}
            >
              Any chakra
            </button>
          </li>
          {CHAKRAS.map((c) => (
            <li key={c.name}>
              <button
                onClick={() => setParam('chakra', c.name)}
                className={`flex items-center gap-2 text-[0.85rem] transition-colors ${
                  chakra === c.name ? 'text-brand' : 'text-ink hover:text-brand'
                }`}
              >
                <ChakraDot name={c.name} size={7} /> {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {activeCount > 0 && (
        <button onClick={clearAll} className="btn btn-outline btn-sm w-full">
          <X size={13} /> Clear all filters
        </button>
      )}
    </div>
  );
}

export default function Shop() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);

  const cat = category || 'all';
  const zodiac = params.get('zodiac') || 'all';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'popular';
  const maxPrice = params.get('max') || '';
  const chakra = params.get('chakra') || 'all';

  const { data, loading } = useAsync(
    () => api.products({ category: cat, zodiac, q, sort, max: maxPrice }),
    [cat, zodiac, q, sort, maxPrice]
  );

  const products = useMemo(
    () => (data || []).filter((p) => chakra === 'all' || p.chakra === chakra),
    [data, chakra]
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
    setMobileFilters(false);
  };

  const clearAll = () => { setParams(new URLSearchParams(), { replace: true }); setMobileFilters(false); };
  const activeCount = [zodiac !== 'all', chakra !== 'all', !!maxPrice, !!q].filter(Boolean).length;
  const heading = HEADINGS[cat] || HEADINGS.all;

  const filterProps = { zodiac, chakra, maxPrice, q, setParam, clearAll, activeCount };

  return (
    <>
      {/* breadcrumb + heading */}
      <div className="border-b border-line bg-bg2">
        <div className="wrap py-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.76rem] text-muted [&_a]:-my-2 [&_a]:py-2">
            <Link to="/" className="hover:text-brand">Home</Link>
            <ChevronRight size={12} className="opacity-50" />
            <Link to="/shop" className="hover:text-brand">Shop</Link>
            {cat !== 'all' && (
              <>
                <ChevronRight size={12} className="opacity-50" />
                <span className="text-ink">{CATEGORIES.find((c) => c.slug === cat)?.name}</span>
              </>
            )}
          </nav>
          <h1 className="mt-3 text-3xl sm:text-4xl">{heading.title}</h1>
          <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted">{heading.sub}</p>
        </div>
      </div>

      {/* category tabs */}
      <div className="border-b border-line bg-surface">
        <div className="wrap no-scrollbar flex gap-1 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={c.slug === 'all' ? '/shop' : `/shop/${c.slug}`}
              className={`whitespace-nowrap border-b-2 px-3.5 py-3.5 text-[0.82rem] font-medium transition-colors ${
                cat === c.slug ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="wrap py-8">
        <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* ------------------------------------------- desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <h2 className="mb-5 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-muted">Filters</h2>
              <Filters {...filterProps} />
            </div>
          </aside>

          {/* ---------------------------------------------------- results */}
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.85rem] text-muted">
                {loading ? 'Loading…' : (
                  <>Showing <strong className="text-ink">{products.length}</strong> {products.length === 1 ? 'product' : 'products'}</>
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileFilters(true)}
                  className="btn btn-outline btn-sm lg:hidden"
                >
                  <SlidersHorizontal size={13} /> Filters
                  {activeCount > 0 && <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[0.62rem] text-onbrand">{activeCount}</span>}
                </button>

                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setParam('sort', e.target.value)}
                    className="field !w-auto !py-2 !pr-9 text-[0.82rem]"
                    aria-label="Sort products"
                  >
                    {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            {/* active filter pills */}
            {activeCount > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {q && (
                  <button onClick={() => setParam('q', '')} className="badge badge-brand">
                    “{q}” <X size={11} />
                  </button>
                )}
                {zodiac !== 'all' && (
                  <button onClick={() => setParam('zodiac', 'all')} className="badge badge-brand">
                    {ZODIAC.find((z) => z.id === zodiac)?.name} <X size={11} />
                  </button>
                )}
                {chakra !== 'all' && (
                  <button onClick={() => setParam('chakra', 'all')} className="badge badge-brand">
                    {chakra} chakra <X size={11} />
                  </button>
                )}
                {maxPrice && (
                  <button onClick={() => setParam('max', '')} className="badge badge-brand">
                    Under {inr(+maxPrice)} <X size={11} />
                  </button>
                )}
                <button onClick={clearAll} className="text-[0.78rem] text-muted underline underline-offset-2 hover:text-ink">
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <div className={GRID}>
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="skeleton aspect-[4/7]" style={{ borderRadius: 'var(--r-card)' }} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="border border-line bg-surface py-20 text-center" style={{ borderRadius: 'var(--r-card)' }}>
                <h2 className="text-xl font-medium">No products match those filters</h2>
                <p className="mx-auto mt-2 max-w-sm text-[0.88rem] text-muted">
                  Try removing a filter, or tell us what you are looking for — custom pieces are made here every week.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={clearAll} className="btn btn-outline">Clear filters</button>
                  <Link to="/book" className="btn btn-primary">Ask Swati</Link>
                </div>
              </div>
            ) : (
              <Stagger key={`${cat}-${zodiac}-${sort}-${q}-${chakra}-${maxPrice}`} className={GRID}>
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </Stagger>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------- mobile filter sheet */}
      <AnimatePresence>
        {mobileFilters && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileFilters(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
                <h2 className="text-base font-medium">Filters</h2>
                <button onClick={() => setMobileFilters(false)} className="rounded-[var(--r-btn)] p-2 hover:bg-bg2" aria-label="Close filters">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <Filters {...filterProps} />
                <button onClick={() => setMobileFilters(false)} className="btn btn-primary mt-6 w-full">
                  Show {products.length} products
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
