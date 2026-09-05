import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu, X, ShoppingBag, Search, Phone, Truck, ChevronRight, User, Sparkles,
} from 'lucide-react';

import { useShop } from '../lib/store.jsx';
import { useAccount } from '../lib/account.jsx';
import Logo from './Logo.jsx';

/* `from` is the width at which a link earns its place in the bar. The four
   category links are the shop and always show once there is a bar at all; About
   and Contact wait for a wider screen and live in the menu and footer until
   then. Without this the row simply ran past the right edge of a 1024px
   laptop — every link was set to `nowrap`, so nothing could give. */
export const NAV_LINKS = [
  { to: '/shop/wellness-bracelets', label: 'Wellness' },
  { to: '/shop/zodiac-bracelets', label: 'Zodiac' },
  { to: '/shop/rudraksha', label: 'Rudraksha' },
  { to: '/shop/sukoon-special', label: 'Sukoon Special' },
  { to: '/about', label: 'About', from: 'hidden xl:inline-flex' },
  { to: '/contact', label: 'Contact', from: 'hidden xl:inline-flex' },
];

/* Kept for anywhere that wants the type without the mark. */
export function Wordmark({ stacked = false, size = 'md', className = '' }) {
  const scale = { sm: 'text-base', md: 'text-xl', lg: 'text-[1.75rem]' }[size];
  return (
    <Link to="/" className={`inline-flex flex-col ${stacked ? 'items-center' : ''} ${className}`}>
      <span className={`font-display leading-none tracking-[0.16em] ${scale}`}>SUKOON</span>
      <span className="mt-1 text-[0.52rem] font-medium uppercase leading-none tracking-[0.34em] text-muted">
        Crystal Solutions
      </span>
    </Link>
  );
}

/* --------------------------------------------------------------- pieces */

function AccountButton() {
  const account = useAccount();
  const name = account?.user?.name?.split(' ')[0];
  return (
    <Link
      to="/account"
      className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-bg2"
      aria-label={name ? `Account, signed in as ${name}` : 'Sign in to your account'}
      title={name ? `Signed in as ${name}` : 'Sign in'}
    >
      <User size={18} strokeWidth={1.6} />
    </Link>
  );
}

function CartButton() {
  const { count, setDrawerOpen } = useShop();
  return (
    <button
      onClick={() => setDrawerOpen(true)}
      className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-bg2"
      aria-label={`Cart, ${count} items`}
    >
      <ShoppingBag size={18} strokeWidth={1.6} />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-0 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-semibold text-onbrand"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SearchInline({ className = '', placeholder = 'Search crystals, signs, concerns…', autoFocus = false }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/shop?q=${encodeURIComponent(q.trim())}`); }}
      className={`relative ${className}`}
    >
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        autoFocus={autoFocus}
        className="field !py-2.5 !pl-10"
      />
    </form>
  );
}

/* ------------------------------------------------------------ mobile menu */
function MobileMenu({ open, onClose }) {
  const { settings } = useShop();
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-surface"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <Logo size={34} />
              <button onClick={onClose} className="p-2" aria-label="Close menu"><X size={19} strokeWidth={1.5} /></button>
            </div>
            <div className="border-b border-line p-4"><SearchInline placeholder="Search crystals…" /></div>
            <nav className="flex-1 overflow-y-auto">
              <Link
                to="/birth-chart" onClick={onClose}
                className="flex items-center justify-between border-b border-line bg-brand-soft px-5 py-3.5 text-[0.92rem] text-brand"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={1.9} /> Free birth chart
                </span>
                <span className="rounded-full bg-brand px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-onbrand">Free</span>
              </Link>
              {[{ to: '/shop', label: 'Shop all crystals' }, ...NAV_LINKS,
                { to: '/account', label: 'My account' },
                { to: '/calendar', label: 'Celestial calendar' },
                { to: '/track', label: 'Track my order' }].map((l) => (
                <Link key={l.to} to={l.to} onClick={onClose} className="flex items-center justify-between border-b border-line px-5 py-3.5 text-[0.92rem]">
                  {l.label} <ChevronRight size={14} className="text-muted" />
                </Link>
              ))}
            </nav>
            <div className="space-y-2 border-t border-line p-4">
              <Link to="/book" onClick={onClose} className="btn btn-primary w-full">
                <Phone size={14} strokeWidth={1.9} /> Book a free consultation
              </Link>
              <a href={`tel:${(settings?.phone || '+919012257555').replace(/\s/g, '')}`} className="btn btn-outline w-full">
                {settings?.phone || '+91 90122 57555'}
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ root */

/**
 * One header, one row.
 *
 * This replaced four per-design variants stacked three and four bars deep —
 * logo row, nav row, utility row — which pushed the hero most of the way down
 * the first screen. Everything now sits on a single 60px line: mark and
 * wordmark left, navigation centred, actions right. It shrinks to 52px and
 * gains a hairline shadow once you scroll.
 */
export default function Header() {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); setSearching(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50">
        <div
          className={`border-b border-line bg-bg/90 backdrop-blur-md transition-shadow ${
            scrolled ? 'shadow-[0_1px_16px_-8px_rgb(0_0_0_/_0.25)]' : ''
          }`}
        >
          <div className="wrap flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => setOpen(true)} className="-ml-2 p-2 lg:hidden" aria-label="Menu">
              <Menu size={20} strokeWidth={1.5} />
            </button>

            {/* The wordmark is dropped below `sm` so the mark, the actions and
                the cart all fit a 360px phone without the row overflowing. */}
            <Logo
              size={scrolled ? 34 : 40}
              textClassName="hidden sm:block"
              className="shrink-0 transition-all duration-200"
            />

            {/* Centred navigation. `flex-1` on both sides keeps the links
                optically centred whatever the width of the two end groups. */}
            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-4 lg:flex xl:gap-6">
              {NAV_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={`whitespace-nowrap text-[0.7rem] uppercase tracking-[0.1em] transition-opacity hover:opacity-60 xl:text-[0.74rem] xl:tracking-[0.14em] ${l.from || ''}`}
                >
                  {({ isActive }) => <span className="link-underline" data-active={isActive}>{l.label}</span>}
                </NavLink>
              ))}
              {/* Given a pill rather than a seventh grey word: it is the one
                  free thing in the header and it should not read as navigation. */}
              <NavLink
                to="/birth-chart"
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand/35 bg-brand-soft px-2.5 py-1.5 text-[0.66rem] uppercase tracking-[0.08em] text-brand transition-colors hover:bg-brand hover:text-onbrand xl:px-3 xl:text-[0.7rem] xl:tracking-[0.12em]"
              >
                <Sparkles size={11} strokeWidth={2} />
                <span className="xl:hidden">Free chart</span>
                <span className="hidden xl:inline">Free birth chart</span>
              </NavLink>
            </nav>

            <div className={`ml-auto flex shrink-0 items-center gap-0.5 transition-all ${scrolled ? 'py-2' : 'py-2.5'}`}>
              <button
                onClick={() => setSearching((s) => !s)}
                className="hidden h-9 w-9 place-items-center rounded-full transition-colors hover:bg-bg2 lg:grid"
                aria-label="Search"
                aria-expanded={searching}
              >
                {searching ? <X size={18} strokeWidth={1.6} /> : <Search size={18} strokeWidth={1.6} />}
              </button>
              <Link
                to="/track"
                className="hidden whitespace-nowrap px-2.5 py-2 text-[0.74rem] uppercase tracking-[0.14em] transition-opacity hover:opacity-60 xl:block"
              >
                Track order
              </Link>
              <AccountButton />
              <CartButton />
              {/* Wrapped rather than given `hidden` directly: `.btn` sets its own
                  `display`, which beats the utility and left this overflowing
                  the right edge on a phone. */}
              <span className="ml-2 hidden 2xl:block">
                <Link to="/book" className="btn btn-accent btn-sm whitespace-nowrap">
                  Book a call
                </Link>
              </span>
            </div>
          </div>

          {/* Search expands in place rather than pushing a permanent bar into
              the header, so the resting height stays at one row. */}
          <AnimatePresence>
            {searching && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden border-t border-line"
              >
                <div className="wrap py-3">
                  <SearchInline autoFocus />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
