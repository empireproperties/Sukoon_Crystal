import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Phone, MapPin, ArrowRight, ShieldCheck, Truck, RotateCcw, BadgeCheck } from 'lucide-react';

import { useShop } from '../lib/store.jsx';
import Logo from './Logo.jsx';

export const SOCIAL = {
  facebook: 'https://www.facebook.com/share/172mmAvJKY/?mibextid=wwXIfr',
  instagram: 'https://www.instagram.com/sukoon.crystalsolutions?igsh=bWVrZjd6ZzJmbHFx',
};

export const CONTACT = {
  address: '1st Floor, A-97 Roorkee Road, Modi Puram, Meerut',
  phone: '+91 90122 57555',
  phoneHref: 'tel:+919012257555',
  email: 'sukoon.crystalsolutions@gmail.com',
};

const SHOP_LINKS = [
  ['Wellness Bracelets', '/shop/wellness-bracelets'],
  ['Zodiac Bracelets', '/shop/zodiac-bracelets'],
  ['Rudraksha', '/shop/rudraksha'],
  ['Sukoon Special', '/shop/sukoon-special'],
  ['All products', '/shop'],
];

/* Mirrors the owner's own list, in her order. Each maps to a page seeded in
   server/content.js, so none of these can 404. */
const QUICK_LINKS = [
  ['About Us', '/about'],
  ['Privacy Policy', '/privacy-policy'],
  ['Terms of Service', '/terms-of-service'],
  ['Shipping Policy', '/shipping-policy'],
  ['Return & Refund Policy', '/return-refund-policy'],
  ["FAQ's", '/faq'],
];

const HELP_LINKS = [
  ['Book a consultation', '/book'],
  ['Track your order', '/track'],
  ['My account', '/account'],
  ['Celestial calendar', '/calendar'],
  ['Contact us', '/contact'],
];

export const TRUST_POINTS = [
  { icon: BadgeCheck, title: 'Genuine stones', text: 'Sourced directly and checked by hand — never dyed glass.' },
  { icon: ShieldCheck, title: 'Energised before dispatch', text: 'Cleansed in salt and charged with mantra at our Meerut studio.' },
  { icon: Truck, title: 'Free shipping above ₹999', text: 'Across India, with cash on delivery available.' },
  { icon: RotateCcw, title: '7-day replacement', text: 'On any breakage or defect, no questions asked.' },
];

function Newsletter() {
  const { toast } = useShop();
  const [email, setEmail] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.includes('@')) return toast('Please enter a valid email address.', 'warn');
        setEmail('');
        toast('You are subscribed. Look out for our next letter.', 'success');
      }}
      className="flex gap-2"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        aria-label="Your email address"
        className="field flex-1"
      />
      <button className="btn btn-primary shrink-0" aria-label="Subscribe">
        <ArrowRight size={15} />
      </button>
    </form>
  );
}

function Column({ title, links }) {
  return (
    <div>
      <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-[0.86rem] text-muted transition-colors hover:text-brand">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { settings } = useShop();
  const year = new Date().getFullYear();

  /* Admin > Appearance can override these; the constants above are the
     fallback so the links are never dead on a fresh install. */
  const social = {
    instagram: settings?.instagram || SOCIAL.instagram,
    facebook: settings?.facebook || SOCIAL.facebook,
  };
  const contact = {
    address: settings?.address || CONTACT.address,
    phone: settings?.phone || CONTACT.phone,
    email: settings?.email || CONTACT.email,
  };
  const phoneHref = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;

  return (
    <footer className="mt-4 border-t border-line bg-bg2">
      <div className="wrap py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-12">
          {/* ---------------------------------------------------- about us */}
          <div className="max-w-sm">
            <Logo size={46} />
            <h3 className="mt-5 text-[0.7rem] uppercase tracking-[0.2em] text-muted">About Us</h3>
            <p className="mt-3 text-[0.86rem] leading-relaxed text-muted">
              I&apos;m <strong className="font-medium text-ink">Swati Khanna</strong>, founder of Sukoon
              CrystalSolutions, certified astrologer &amp; numerologist with 10+ years of experience.
              I guide people towards clarity, balance &amp; harmony through astrology, numerology, and
              personalized crystal remedies, helping you find true &lsquo;Sukoon&rsquo; in life.
            </p>

            <div className="mt-6 flex gap-2.5">
              <a href={social.instagram} target="_blank" rel="noreferrer noopener" aria-label="Sukoon on Instagram"
                className="grid h-9 w-9 place-items-center border border-line text-muted transition-colors hover:border-brand hover:text-brand"
                style={{ borderRadius: 'var(--r-btn)' }}>
                <Instagram size={16} strokeWidth={1.7} />
              </a>
              <a href={social.facebook} target="_blank" rel="noreferrer noopener" aria-label="Sukoon on Facebook"
                className="grid h-9 w-9 place-items-center border border-line text-muted transition-colors hover:border-brand hover:text-brand"
                style={{ borderRadius: 'var(--r-btn)' }}>
                <Facebook size={16} strokeWidth={1.7} />
              </a>
            </div>
          </div>

          <Column title="Shop" links={SHOP_LINKS} />
          <Column title="Quick links" links={QUICK_LINKS} />

          {/* ------------------------------------------- customer support */}
          <div>
            <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Customer Support</h3>
            <ul className="mt-4 space-y-3.5">
              <li className="flex gap-2.5">
                <MapPin size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-muted" />
                <span className="text-[0.84rem] leading-relaxed text-muted">{contact.address}</span>
              </li>
              <li className="flex gap-2.5">
                <Phone size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-muted" />
                <a href={phoneHref} className="-my-1.5 py-1.5 text-[0.84rem] text-muted transition-colors hover:text-brand">
                  {contact.phone}
                </a>
              </li>
              <li className="flex gap-2.5">
                <Mail size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-muted" />
                <a href={`mailto:${contact.email}`} className="-my-1.5 break-all py-1.5 text-[0.84rem] text-muted transition-colors hover:text-brand">
                  {contact.email}
                </a>
              </li>
            </ul>

            <ul className="mt-6 space-y-2.5">
              {HELP_LINKS.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-[0.86rem] text-muted transition-colors hover:text-brand">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <p className="text-[0.82rem] font-medium">Letters from the studio</p>
              <p className="mt-1 text-[0.78rem] text-muted">New moons, new pieces. Never more than twice a month.</p>
              <div className="mt-3"><Newsletter /></div>
            </div>
            <p className="text-[0.75rem] leading-relaxed text-muted sm:text-right">
              © {year} Sukoon Crystal Solutions.<br className="hidden sm:block" /> All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
