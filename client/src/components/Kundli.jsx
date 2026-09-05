import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sunrise, Moon, Sun, Star, Gem, ChevronDown, Video, Download, RefreshCw, Info,
} from 'lucide-react';

import ProductCard from './ProductCard.jsx';

/* ------------------------------------------------------------------- svg */
/**
 * The kundli arrives as SVG markup from the chart service. It is rendered
 * through a blob URL in an <img> rather than injected into the page: an image
 * context cannot run script, so even if that markup ever changed shape it can
 * only ever be a picture. It stays crisp at any size, which inline HTML would
 * also give us, without the one risk that matters.
 */
function ChartImage({ svg, alt }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!svg) return undefined;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [svg]);

  if (!url) return <div className="skeleton aspect-square w-full rounded-[var(--r-card)]" />;
  return <img src={url} alt={alt} className="w-full" />;
}

/* --------------------------------------------------------------- pieces */
function SignCard({ icon: Icon, kicker, sign, sanskrit, meta, text, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="border border-line bg-surface p-5"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <p className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-muted">
        <Icon size={12} strokeWidth={1.9} /> {kicker}
      </p>
      <p className="mt-2 font-display text-[1.45rem] leading-none">{sign}</p>
      <p className="mt-1 text-[0.76rem] text-muted">{sanskrit}{meta ? ` · ${meta}` : ''}</p>
      {text && <p className="mt-3 text-[0.86rem] leading-relaxed text-ink/85">{text}</p>}
    </motion.div>
  );
}

const dignityTone = { exalted: 'text-ok', debilitated: 'text-sale' };

function Placements({ rows }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span>
          <span className="text-[0.95rem] font-medium">Where your planets sit</span>
          <span className="mt-0.5 block text-[0.78rem] text-muted">
            The full table — sign, house and birth star for each graha
          </span>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[440px] border-collapse text-[0.82rem]">
            <thead>
              <tr className="bg-bg2 text-left">
                {['Graha', 'Sign', 'House', 'Nakshatra'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.name} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    {p.name}
                    {p.retrograde && <span className="ml-1.5 text-[0.68rem] text-muted" title="Retrograde">℞</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.sign} <span className="text-muted tnum">{p.degree}°</span>
                    {p.dignity && (
                      <span className={`ml-1.5 text-[0.68rem] ${dignityTone[p.dignity]}`}>{p.dignity}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tnum">{p.house}</td>
                  <td className="px-4 py-2.5 text-muted">{p.nakshatra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ view */
/**
 * @param forSale  false in the admin, where Swati is reading a customer's chart
 *                 before a call and does not need to be sold anything.
 */
export default function Kundli({ chart, onRedraw, compact = false, forSale = true }) {
  const { reading, birth, svg, recommended = [] } = chart;

  const born = useMemo(() => {
    const d = new Date(Date.UTC(birth.year, birth.month - 1, birth.day));
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const time = birth.timeKnown === false
      ? 'time not known'
      : `${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}`;
    return `${date} · ${time} · ${[birth.city, birth.state].filter(Boolean).join(', ')}`;
  }, [birth]);

  const download = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kundli.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={compact ? '' : 'grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-12'}>
      {/* ─────────────────────────────────────────────────────── the chart */}
      <div className={compact ? '' : 'lg:sticky lg:top-24 lg:self-start'}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="overflow-hidden border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
          style={{ borderRadius: 'var(--r-card)' }}
        >
          <ChartImage svg={svg} alt="Your Vedic birth chart, North Indian style" />
        </motion.div>

        <p className="mt-3 text-center text-[0.78rem] leading-relaxed text-muted">{born}</p>

        <div className="mt-3 flex justify-center gap-2">
          <button onClick={download} className="btn btn-sm border border-line">
            <Download size={13} /> Save chart
          </button>
          {onRedraw && (
            <button onClick={onRedraw} className="btn btn-sm border border-line">
              <RefreshCw size={13} /> Change details
            </button>
          )}
        </div>

        {birth.timeKnown === false && (
          <p className="mt-4 flex items-start gap-2 border border-line bg-bg2 p-3 text-[0.76rem] leading-relaxed text-muted"
             style={{ borderRadius: 'var(--r-btn)' }}>
            <Info size={13} className="mt-0.5 shrink-0" />
            Drawn for midday, since you did not know your birth time. Your moon sign and birth
            star are right; the rising sign and house positions are an estimate.
          </p>
        )}
      </div>

      {/* ──────────────────────────────────────────────────── the reading */}
      <div className="space-y-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {reading.lagna && (
            <SignCard
              index={0} icon={Sunrise} kicker="Rising · Lagna"
              sign={reading.lagna.sign} sanskrit={reading.lagna.sanskrit}
              meta={`ruled by ${reading.lagna.lord}`} text={reading.lagna.text}
            />
          )}
          {reading.moon && (
            <SignCard
              index={1} icon={Moon} kicker="Moon · Rashi"
              sign={reading.moon.sign} sanskrit={reading.moon.sanskrit}
              meta={`${reading.moon.house}th house`} text={reading.moon.text}
            />
          )}
        </div>

        {reading.nakshatra?.text && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="border border-brand/25 bg-brand-soft p-5 sm:p-6"
            style={{ borderRadius: 'var(--r-card)' }}
          >
            <p className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-brand">
              <Star size={12} strokeWidth={1.9} /> Your birth star
            </p>
            <p className="mt-2 font-display text-[1.6rem] leading-none">{reading.nakshatra.name}</p>
            <p className="mt-1 text-[0.76rem] text-muted">
              Pada {reading.nakshatra.pada} · ruled by {reading.nakshatra.lord}
              {reading.sun ? ` · Sun in ${reading.sun.sign}` : ''}
            </p>
            <p className="mt-3 text-[0.92rem] leading-relaxed">{reading.nakshatra.text}</p>
          </motion.div>
        )}

        {reading.sadeSati && (
          <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
            <p className="flex flex-wrap items-center gap-2 text-[0.95rem] font-medium">
              Sade Sati
              <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] ${
                reading.sadeSati.active ? 'bg-accent/15 text-accent' : 'bg-bg2 text-muted'}`}>
                {reading.sadeSati.active ? `Running${reading.sadeSati.phase ? ` · ${reading.sadeSati.phase}` : ''}` : 'Not running'}
              </span>
            </p>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-ink/85">{reading.sadeSati.text}</p>
          </div>
        )}

        <Placements rows={reading.placements} />

        {/* ─────────────────────────────────── stones, and why these ones */}
        {reading.support?.length > 0 && (
          <section>
            <h2 className="font-display text-[1.35rem]">Stones for your chart</h2>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">
              Chosen from what your chart is asking for — not from what is popular this week.
            </p>

            <div className="mt-4 space-y-2.5">
              {reading.support.map((s, i) => (
                <motion.div
                  key={s.graha}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i }}
                  className="flex gap-3.5 border border-line bg-surface p-4"
                  style={{ borderRadius: 'var(--r-card)' }}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Gem size={14} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.9rem] font-medium">{s.graha}</p>
                    <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted">
                      Because {s.why}. Worn for {s.helps}.
                    </p>
                    <p className="mt-1.5 text-[0.78rem] text-brand">{s.stones.join(' · ')}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {forSale && recommended.length > 0 && (
          <section>
            <h2 className="font-display text-[1.35rem]">From the shop, for you</h2>
            <p className="mt-1.5 text-[0.86rem] text-muted">
              Pieces we make that carry those stones.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {recommended.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} animate={false} />
              ))}
            </div>
          </section>
        )}

        {/* ───────────────────────────────────────────── the consultation */}
        {/* Animated on mount rather than on scroll: this is the one button the
            whole page is building towards, and a scroll-triggered reveal that
            never fires leaves it invisible. */}
        {forSale && (
        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="relative overflow-hidden border border-brand/30 bg-brand-soft p-6 sm:p-8"
          style={{ borderRadius: 'var(--r-card)' }}
        >
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-brand">Go deeper</p>
          <h2 className="mt-2 font-display text-[1.5rem] leading-tight sm:text-[1.75rem]">
            Have Swati read this chart with you
          </h2>
          <p className="mt-2.5 max-w-lg text-[0.9rem] leading-relaxed text-ink/80">
            What is above is the outline. On a call Swati goes through your dashas, the timing of
            what you are in the middle of, and which of these stones to actually wear — and in
            what order.
          </p>
          <Link to="/book" className="btn btn-primary btn-lg mt-5">
            <Video size={16} strokeWidth={1.8} /> Book a consultation
          </Link>
        </motion.section>
        )}

        <p className="text-[0.74rem] leading-relaxed text-muted">
          Calculated with the Lahiri ayanamsha and whole-sign houses, the standard for Vedic
          charts in India. Offered as astrology-oriented guidance and a starting point for
          conversation — not as medical, legal or financial advice.
        </p>
      </div>
    </div>
  );
}
