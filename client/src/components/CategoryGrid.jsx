import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

/* Order and wording are fixed here rather than taken from the database, because
   this is the shop's front door and the sequence is an editorial decision.
   Everything else about a category (name, image, count) still comes from the API. */
export const CATEGORY_ORDER = [
  'wellness-bracelets',
  'zodiac-bracelets',
  'rudraksha',
  'sukoon-special',
];

const COPY = {
  'wellness-bracelets': 'Everyday remedies, worn on the wrist',
  'zodiac-bracelets': 'Chosen for your sign and its element',
  'rudraksha': 'Authentic beads, energised with mantra',
  'sukoon-special': 'Our own blends, made in small batches',
};

export default function CategoryGrid({ categories = [], products = [] }) {
  /* Fall back to a product image so a category tile is never blank before the
     owner has uploaded artwork for it. */
  const imageFor = (slug) =>
    categories.find((c) => c.slug === slug)?.image
    || products.find((p) => p.category === slug && p.images?.length)?.images[0]
    || '';

  const ordered = CATEGORY_ORDER
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter(Boolean);

  const list = ordered.length ? ordered : categories;
  if (!list.length) return null;

  return (
    <section className="wrap py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">Collections</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[clamp(1.6rem,4vw,2.5rem)] leading-tight">
            Shop by category
          </h2>
        </div>
        <Link to="/shop" className="hidden shrink-0 items-center gap-1.5 text-[0.84rem] text-muted transition-colors hover:text-brand sm:inline-flex">
          All products <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {list.map((c, i) => {
          const img = imageFor(c.slug);
          return (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
            >
              <Link
                to={`/shop/${c.slug}`}
                className="group relative block overflow-hidden border border-line"
                style={{ borderRadius: 'var(--r-card)' }}
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-bg2">
                  {img ? (
                    <img
                      src={img}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="h-full w-full bg-[var(--c-brand-soft)]" />
                  )}
                </div>

                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(0deg, rgba(10,10,8,0.8) 0%, rgba(10,10,8,0.25) 42%, rgba(10,10,8,0) 70%)' }}
                />

                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5" style={{ color: '#fbf9f4' }}>
                  <h3 className="font-[var(--font-display)] text-[1.05rem] leading-tight sm:text-[1.2rem]">{c.name}</h3>
                  <p className="mt-1 hidden text-[0.78rem] leading-snug opacity-80 sm:block">
                    {COPY[c.slug] || c.tagline || ''}
                  </p>
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[0.72rem] uppercase tracking-[0.16em] opacity-90">
                    {c.count ? `${c.count} pieces` : 'Explore'}
                    <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
