import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

import { api } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import TrustCards from '../components/TrustCards.jsx';
import ReviewsRail from '../components/ReviewsRail.jsx';

/* The copy lives in the database (server/content.js seeds it) so Sukoon can
   edit it from the admin. This page only decides how it is presented. */
export default function About() {
  const { settings } = useShop();
  const page = useAsync(() => api.page('about'), []);
  const reviews = useAsync(() => api.reviews({ limit: 12 }), []);

  const sections = page.data?.sections || [];
  const intro = sections.find((s) => !s.heading);
  const founder = sections.find((s) => s.heading === 'Founder');
  const portrait = settings?.founderImage || '';

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="border-b border-line bg-bg2">
        <div className="wrap py-16 text-center sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.24em] text-muted">
              <Sparkles size={12} /> Since 2024
            </span>
            <h1 className="mx-auto mt-4 max-w-3xl font-[var(--font-display)] text-[clamp(2.1rem,6vw,3.7rem)] leading-[1.06]">
              About Us
            </h1>
            {intro && (
              <div className="mx-auto mt-6 max-w-2xl space-y-4 text-[1rem] leading-relaxed text-muted">
                {intro.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* --------------------------------------------------------- founder */}
      <section className="wrap py-16 sm:py-24">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:max-w-none"
          >
            <div className="relative overflow-hidden border border-line shadow-[var(--shadow-card)]"
                 style={{ borderRadius: 'var(--r-card)' }}>
              <div className="aspect-[4/5] w-full bg-bg2">
                {portrait ? (
                  <img src={portrait} alt="Swati Khanna" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[var(--c-brand-soft)] px-6 text-center">
                    <p className="text-[0.8rem] leading-relaxed text-muted">
                      Upload a portrait of Swati under<br />Admin → Appearance
                    </p>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-brand px-5 py-4 text-center">
                <p className="font-[var(--font-display)] text-[1.15rem] leading-none text-white">Swati Khanna</p>
                <p className="mt-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/70">
                  Founder · Astrologer &amp; Numerologist
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">Founder</p>
            <h2 className="mt-3 font-[var(--font-display)] text-[clamp(1.8rem,4.5vw,2.8rem)] leading-[1.1]">
              Namaste, I&apos;m Swati
            </h2>

            <div className="mt-6 space-y-5 text-[0.97rem] leading-relaxed text-muted">
              {(founder?.body || []).slice(1).map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <blockquote className="mt-8 border-l-2 border-accent pl-5 font-[var(--font-display)] text-[1.15rem] leading-snug text-ink">
              My goal is simple: to help you find &lsquo;Sukoon&rsquo; — deep peace — in your life&apos;s journey.
            </blockquote>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book" className="btn btn-primary btn-lg">
                Book a consultation <ArrowRight size={15} />
              </Link>
              <Link to="/shop" className="btn btn-lg border border-line">Browse the collection</Link>
            </div>
          </motion.div>
        </div>
      </section>

      <ReviewsRail reviews={reviews.data || []} />
      <TrustCards />
    </>
  );
}
