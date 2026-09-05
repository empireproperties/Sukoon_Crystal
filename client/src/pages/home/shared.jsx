import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Phone, CalendarDays, ShieldCheck, Quote } from 'lucide-react';

import ProductImage from '../../components/ProductImage.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import { Reveal, Stagger, staggerItem, CountUp } from '../../components/Motion.jsx';
import { Stars, ZODIAC } from '../../components/Ornaments.jsx';
import { TRUST_POINTS } from '../../components/Footer.jsx';
import { dateLabel } from '../../lib/api.js';

/** A deliberately small landing selection — six pieces, not the whole shelf. */
export const EDIT_SIZE = 6;

export const CONCERNS = [
  { label: 'Money & abundance', q: 'money' },
  { label: 'Protection', q: 'protection' },
  { label: 'Love & relationships', q: 'love' },
  { label: 'Stress & calm', q: 'stress' },
  { label: 'Anger & patience', q: 'anger' },
  { label: 'Success & recognition', q: 'fame' },
];

export const COLLECTIONS = [
  { slug: 'wellness-bracelets', name: 'Wellness Bracelets', line: 'For what is weighing on you', from: '₹999' },
  { slug: 'zodiac-bracelets', name: 'Zodiac Bracelets', line: 'Chosen for your birth sign', from: '₹999' },
  { slug: 'rudraksha', name: 'Rudraksha', line: 'Authentic beads, energised', from: '₹501' },
  { slug: 'sukoon-special', name: 'Sukoon Special', line: 'Plates, trees & rituals', from: '₹299' },
];

export const PROCESS = [
  { n: '01', title: 'We listen', text: 'A short call, your birth details, and the thing that is actually weighing on you. No script.' },
  { n: '02', title: 'We choose', text: 'Swati matches stones to your chart and your moment. Sometimes a single bead is enough.' },
  { n: '03', title: 'We energise', text: 'Cleansed in Himalayan salt, charged under the moon, sealed with mantra, packed by hand.' },
];

export const REVIEWS = [
  {
    name: 'Ritika Sharma', city: 'Meerut', rating: 5,
    product: 'Corporate Majdoor Stress Relief Bracelet',
    text: 'I had been sleeping badly for months. Swati suggested the amethyst bracelet and a short nightly routine — three weeks in, I sleep through. She never pushed me to buy anything extra.',
  },
  {
    name: 'Anand Verma', city: 'New Delhi', rating: 5,
    product: 'Triple Protection Bracelet (Tiger Eye)',
    text: 'Ordered before a difficult stretch at work. What actually surprised me was the follow-up call two weeks later, unprompted, just asking how I was doing.',
  },
  {
    name: 'Farah Qureshi', city: 'Bengaluru', rating: 5,
    product: 'Authentic 5 Mukhi Rudraksha Bracelet',
    text: 'Handwritten note, a ritual card, the bead properly wrapped. It arrived in four days and felt like receiving something, not buying it.',
  },
  {
    name: 'Deepa Nair', city: 'Pune', rating: 4,
    product: 'Numerology consultation',
    text: 'I was sceptical about the reading. An hour later I had the clearest picture of my own patterns I have had in years. Booked my mother the following week.',
  },
];

/* ------------------------------------------------------------- headings */
export function SectionHead({ eyebrow, title, sub, align = 'left', action, className = '' }) {
  const centred = align === 'center';
  return (
    <div className={`${centred ? 'text-center' : 'flex flex-wrap items-end justify-between gap-5'} ${className}`}>
      <div className={centred ? 'mx-auto max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="h-sec mt-2.5 balance">{title}</h2>
        {sub && <p className="mt-3.5 text-[0.94rem] leading-relaxed text-muted">{sub}</p>}
      </div>
      {action && <div className={centred ? 'mt-6' : ''}>{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- product grid */
export function ProductGrid({ products = [], loading, cols = 3, skeletons }) {
  /* Two columns from the smallest phone up. A single full-width card shows the
     shopper one product per screen and makes a 12-product row feel like a
     chore. Past the phone the count climbs quickly for the opposite reason: a
     card is as tall as it is wide plus its copy, so a two-up grid on a desktop
     produces the 700px tile this ladder exists to avoid. */
  const cls = {
    2: 'grid grid-cols-2 gap-3 sm:gap-6',
    3: 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6',
    4: 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4',
  }[cols];

  if (loading) {
    return (
      <div className={cls}>
        {Array.from({ length: skeletons || cols * 2 }, (_, i) => (
          <div key={i} className="skeleton aspect-[4/7] rounded-[var(--r-card)]" />
        ))}
      </div>
    );
  }
  return (
    <Stagger className={cls}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </Stagger>
  );
}

/* --------------------------------------------------------- concern rail */
export function ConcernRail({ rounded = false, centred = false }) {
  return (
    <div className={`no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0 ${centred ? 'lg:justify-center' : ''}`}>
      {CONCERNS.map((c) => (
        <Link
          key={c.q}
          to={`/shop?q=${c.q}`}
          className={`shrink-0 border border-line bg-surface px-4 py-2.5 text-[0.84rem] transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand ${
            rounded ? 'rounded-full' : 'rounded-[var(--r-btn)]'
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- zodiac strip */
export function ZodiacStrip({ bordered = true }) {
  return (
    <div className={`grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12 ${bordered ? '' : 'gap-3'}`}>
      {ZODIAC.map((z) => (
        <Link
          key={z.id}
          to={`/shop?zodiac=${z.id}`}
          className="group flex flex-col items-center gap-1.5 rounded-[var(--r-card)] border border-line bg-surface px-2 py-4 text-center transition-colors hover:border-brand hover:bg-brand-soft"
        >
          <span className="text-xl text-accent transition-transform duration-200 group-hover:scale-110">{z.glyph}</span>
          <span className="text-[0.73rem] font-medium leading-tight">{z.name}</span>
          <span className="text-[0.6rem] leading-tight text-muted">{z.dates}</span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ trust row */
export function TrustRow({ variant = 'bordered' }) {
  if (variant === 'plain') {
    return (
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <Icon size={20} strokeWidth={1.5} className="text-accent" />
            <p className="mt-3 text-[0.92rem] font-medium">{title}</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid divide-line sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
      {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3 py-6 lg:px-6 lg:first:pl-0 lg:last:pr-0">
          <Icon size={19} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-[0.88rem] font-medium">{title}</p>
            <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- process */
export function ProcessBlock({ numbered = true }) {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {PROCESS.map((p, i) => (
        <Reveal key={p.n} delay={i * 0.07}>
          <div>
            {numbered && <p className="font-display text-[2.4rem] leading-none text-accent/45">{p.n}</p>}
            <h3 className="mt-3 text-[1.25rem]">{p.title}</h3>
            <span className="my-3.5 block h-px w-12 bg-accent" />
            <p className="text-[0.88rem] leading-relaxed text-muted">{p.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- reviews */
export function Reviews({ columns = 4, align = 'left' }) {
  return (
    <>
      <SectionHead
        eyebrow="Verified reviews"
        title="What customers say"
        sub="Collected after delivery from people who bought and wore the piece."
        align={align}
      />
      <Stagger className={`mt-9 grid gap-5 md:grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4' : ''}`}>
        {REVIEWS.map((r) => (
          <motion.figure key={r.name} variants={staggerItem} className="panel flex h-full flex-col p-5">
            <Stars rating={r.rating} size={13} />
            <blockquote className="mt-3 flex-1 text-[0.88rem] leading-relaxed">{r.text}</blockquote>
            <figcaption className="mt-4 border-t border-line pt-3.5">
              <p className="text-[0.86rem] font-medium">{r.name}</p>
              <p className="text-[0.76rem] text-muted">{r.city}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[0.72rem] text-ok">
                <ShieldCheck size={11} strokeWidth={2} /> Verified purchase · {r.product}
              </p>
            </figcaption>
          </motion.figure>
        ))}
      </Stagger>
    </>
  );
}

/* --------------------------------------------------------- consult band */
export function ConsultBand({ tone = 'soft' }) {
  const onBrand = tone === 'brand';
  return (
    <section className={onBrand ? 'bg-brand text-onbrand' : 'border-y border-line bg-bg2'}>
      <div className="wrap sec-sm grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className={`eyebrow ${onBrand ? '!text-onbrand opacity-70' : ''}`}>Free 15-minute consultation</p>
          <h2 className="h-sec mt-2.5 max-w-xl balance">Not sure which stone is yours? Ask before you buy.</h2>
          <p className={`mt-4 max-w-lg text-[0.92rem] leading-relaxed ${onBrand ? 'opacity-80' : 'text-muted'}`}>
            Swati Khanna reads your birth details, listens to what is actually going on, and tells you
            plainly whether a crystal will help. The first call costs nothing.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/book" className={`btn ${onBrand ? 'btn-accent' : 'btn-primary'}`}>
              <CalendarDays size={15} strokeWidth={1.8} /> Choose a slot
            </Link>
            <a href="tel:+919012257555" className="btn btn-outline">
              <Phone size={14} strokeWidth={1.8} /> +91 90122 57555
            </a>
          </div>
        </div>
        <dl className={`grid grid-cols-3 gap-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 ${onBrand ? 'border-white/20' : 'border-line'}`}>
          {[{ v: 900, s: '+', l: 'Readings given' }, { v: 4200, s: '+', l: 'Orders delivered' }, { v: 6, s: ' yrs', l: 'In practice' }].map((k) => (
            <div key={k.l}>
              <dt className="sr-only">{k.l}</dt>
              <dd>
                <span className="block font-display text-[1.75rem] leading-none"><CountUp to={k.v} suffix={k.s} /></span>
                <span className={`mt-1.5 block text-[0.74rem] ${onBrand ? 'opacity-70' : 'text-muted'}`}>{k.l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- events strip */
export function EventsStrip({ events = [] }) {
  if (!events.length) return null;
  return (
    <>
      <SectionHead
        eyebrow="What's on"
        title="Upcoming rituals & live sessions"
        sub="Full moons, festivals and free live Q&As — all open to attend."
        action={<Link to="/calendar" className="btn btn-outline btn-sm">Full calendar <ArrowRight size={13} /></Link>}
      />
      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {events.slice(0, 4).map((e) => (
          <motion.article key={e.id} variants={staggerItem} className="panel card-hover flex h-full gap-4 p-4">
            <div className="shrink-0 border-r border-line pr-4 text-center">
              <p className="font-display text-[1.6rem] leading-none">{new Date(e.date).getDate()}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                {dateLabel(e.date, { month: 'short' })}
              </p>
            </div>
            <div className="min-w-0">
              <span className="badge badge-neutral capitalize">{e.type}</span>
              <h3 className="mt-2 text-[0.94rem] font-medium leading-snug line-clamp-2">{e.title}</h3>
              <p className="mt-1 text-[0.76rem] text-muted">{e.time} · {e.location}</p>
            </div>
          </motion.article>
        ))}
      </Stagger>
    </>
  );
}

/* ---------------------------------------------------------- story block */
export const STUDIO_IMG =
  'https://cdn.shopify.com/s/files/1/0695/0679/3526/files/hf_20260415_084857_a7c37e0c-c2b1-42e4-a20e-4a2b8c8e3ca3.png?width=1200';

export function StoryBlock({ reversed = false, image = STUDIO_IMG }) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <Reveal>
        <div className="overflow-hidden rounded-[var(--r-card)] bg-bg2">
          <ProductImage src={image} product={{ name: 'The Sukoon studio' }} className="aspect-[4/3]" />
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <p className="eyebrow">About Sukoon</p>
        <h2 className="h-sec mt-2.5 balance">Every piece is chosen by a person, not a filter</h2>
        <div className="mt-5 space-y-4 text-[0.92rem] leading-relaxed text-muted">
          <p>
            Sukoon began in 2019 in a single room in Modi Puram, Meerut. Swati Khanna, a certified
            astrologer and numerologist, started reading for friends of friends and stringing
            bracelets to match what she saw in their charts.
          </p>
          <p>
            That has not changed. Orders are cleansed in Himalayan salt, charged under the moon and
            packed by hand with a written note. Nothing ships the same day it is ordered, because
            nothing here is prepared in a hurry.
          </p>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/about" className="btn btn-outline">Read our story</Link>
          <Link to="/book" className="btn btn-ghost">Talk to Swati <ArrowRight size={14} /></Link>
        </div>
      </Reveal>
    </div>
  );
}

/* ----------------------------------------------------------- pull quote */
export function PullQuote() {
  return (
    <figure className="mx-auto max-w-3xl text-center">
      <Quote size={26} strokeWidth={1.2} className="mx-auto text-accent" />
      <blockquote className="mt-5 font-display text-[1.6rem] leading-[1.35] balance sm:text-[2rem]">
        “People arrive asking which stone is lucky. I ask what has been keeping them up. The answer to
        the second question is the answer to the first.”
      </blockquote>
      <figcaption className="mt-5 text-[0.8rem] text-muted">
        Swati Khanna · Founder, certified astrologer &amp; numerologist
      </figcaption>
    </figure>
  );
}
