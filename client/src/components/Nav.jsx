import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ShoppingBag, Search, Phone, Sparkles } from 'lucide-react';
import { useShop } from '../lib/store.jsx';
import { Magnetic } from './Motion.jsx';

const LINKS = [
  { to: '/shop/wellness-bracelets', label: 'Wellness' },
  { to: '/shop/zodiac-bracelets', label: 'Zodiac' },
  { to: '/shop/rudraksha', label: 'Rudraksha' },
  { to: '/shop/sukoon-special', label: 'Rituals' },
  { to: '/calendar', label: 'Celestial' },
  { to: '/about', label: 'About' },
];

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <span className="relative grid h-10 w-10 place-items-center">
        <span className="absolute inset-0 rounded-full bg-gold/20 blur-md transition-all duration-700 group-hover:bg-gold/40 group-hover:blur-lg" />
        <svg viewBox="0 0 32 32" className="relative h-9 w-9 transition-transform duration-700 group-hover:rotate-[18deg]">
          <path d="M16 2 L27 12 L16 30 L5 12 Z" fill="var(--c-gold)" />
          <path d="M16 2 L27 12 L16 16 Z" fill="var(--c-glow)" />
          <path d="M5 12 L16 16 L16 30 Z" fill="var(--c-gold)" opacity="0.72" />
          <path d="M16 2 L5 12 L16 16 Z" fill="var(--c-glow)" opacity="0.55" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[1.35rem] tracking-wide">Sukoon</span>
          <span className="block text-[0.55rem] uppercase tracking-[0.42em] text-muted">Crystal Solutions</span>
        </span>
      )}
    </Link>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const { count, setDrawerOpen } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false);
  };

  return (
    <>
      <motion.header
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass py-2.5 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)]' : 'bg-transparent py-5'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Logo />

          <ul className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    `underline-sweep text-[0.72rem] uppercase tracking-[0.22em] transition-colors duration-300 ${
                      isActive ? 'text-gold' : 'text-ink/80 hover:text-gold'
                    }`
                  }
                >
                  {({ isActive }) => <span data-active={isActive}>{l.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSearchOpen((s) => !s)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line/60 text-ink/80 transition-all duration-300 hover:border-gold/70 hover:text-gold"
              aria-label="Search"
            >
              <Search size={16} strokeWidth={1.5} />
            </button>

            <button
              onClick={() => setDrawerOpen(true)}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-line/60 text-ink/80 transition-all duration-300 hover:border-gold/70 hover:text-gold"
              aria-label="Cart"
            >
              <ShoppingBag size={16} strokeWidth={1.5} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[0.6rem] font-medium text-void"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <Magnetic strength={0.2} className="hidden sm:block">
              <Link to="/book" className="btn btn-gold !px-6 !py-3 !text-[0.66rem]">
                <Phone size={13} strokeWidth={1.8} /> Book a call
              </Link>
            </Magnetic>

            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line/60 text-ink lg:hidden"
              aria-label="Menu"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {searchOpen && (
            <motion.form
              onSubmit={submitSearch}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search amethyst, protection, Leo, rudraksha…"
                  className="field !rounded-full !py-3.5 !pl-6 font-display !text-lg"
                />
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ---------------------------------------------- mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <div className="absolute inset-0 bg-void/85 backdrop-blur-xl" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l border-line/60 bg-deep px-7 py-7"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line/60">
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              <ul className="mt-12 flex flex-col gap-1">
                {[{ to: '/shop', label: 'All crystals' }, ...LINKS].map((l, i) => (
                  <motion.li
                    key={l.to}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.055, duration: 0.5 }}
                  >
                    <Link
                      to={l.to}
                      className="block border-b border-line/40 py-4 font-display text-2xl transition-colors hover:text-gold"
                    >
                      {l.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-auto space-y-3 pt-8">
                <Link to="/book" className="btn btn-gold w-full">
                  <Sparkles size={14} /> Book a consultation
                </Link>
                <Link to="/track" className="btn btn-ghost w-full">Track my order</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
