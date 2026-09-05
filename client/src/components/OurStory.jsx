import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/* Replace by uploading a portrait in Admin > Appearance; settings.founderImage
   wins over this. Kept as a constant so the section is never a broken image. */
export const FOUNDER_FALLBACK =
  'https://res.cloudinary.com/enf4l41d/image/upload/f_auto,q_auto,w_900/sukoon/founder-placeholder';

const STATS = [
  ['10+', 'Years guiding'],
  ['1,000+', 'People helped'],
  ['100%', 'Genuine stones'],
];

/**
 * The founder introduction. Image on the left, story on the right, with the
 * name plate anchored to the portrait rather than floating beneath it — the
 * detail that makes the reference layout read as designed rather than stacked.
 */
export default function OurStory({ image, settings }) {
  const portrait = image || settings?.founderImage || '';

  return (
    <section className="bg-bg2 py-16 sm:py-24">
      <div className="wrap grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-full max-w-sm lg:max-w-none"
        >
          <div
            className="relative overflow-hidden border border-line bg-surface shadow-[var(--shadow-card)]"
            style={{ borderRadius: 'var(--r-card)' }}
          >
            <div className="aspect-[4/5] w-full bg-bg2">
              {portrait ? (
                <img src={portrait} alt="Swati Khanna, founder of Sukoon Crystal Solutions"
                  loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-[var(--c-brand-soft)] px-6 text-center">
                  <p className="text-[0.8rem] leading-relaxed text-muted">
                    Upload a portrait of Swati under<br />Admin → Appearance
                  </p>
                </div>
              )}
            </div>

            {/* Name plate sits inside the frame, flush to the bottom edge. */}
            <div className="absolute inset-x-0 bottom-0 bg-brand px-5 py-4 text-center">
              <p className="font-[var(--font-display)] text-[1.15rem] leading-none text-white">Swati Khanna</p>
              <p className="mt-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/70">
                Founder · Astrologer & Numerologist
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">Our Story</p>
          <h2 className="mt-3 font-[var(--font-display)] text-[clamp(1.9rem,5vw,3.1rem)] leading-[1.08]">
            Sukoon means<br className="hidden sm:block" /> deep peace
          </h2>

          <div className="mt-6 space-y-4 text-[0.95rem] leading-relaxed text-muted">
            <p>
              Since we began in 2024, we&apos;ve helped over 1,000 people worldwide find more
              positivity and success.
            </p>
            <p>
              We sell beautiful, 100% real <strong className="font-medium text-ink">Gemstone</strong> items like{' '}
              <strong className="font-medium text-ink">Wellness bracelets, Zodiac bracelets, authentic Rudraksha,
              and our Special Sukoon collection.</strong> Each piece is made with a special purpose in mind.
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-5">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <dt className="font-[var(--font-display)] text-[1.6rem] leading-none text-brand">{value}</dt>
                <dd className="mt-1.5 text-[0.72rem] uppercase tracking-[0.14em] text-muted">{label}</dd>
              </div>
            ))}
          </dl>

          <Link to="/about" className="btn btn-primary btn-lg mt-8 inline-flex">
            Read More <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
