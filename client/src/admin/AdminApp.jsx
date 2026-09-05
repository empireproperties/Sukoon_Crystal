import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, CalendarDays, Megaphone, Palette,
  PhoneCall, LogOut, Menu, X, ExternalLink, KeyRound, Users, Star, RotateCcw, Images, FileText, Video, Ticket,
} from 'lucide-react';

import { getToken, setToken } from '../lib/api.js';
import Toasts from '../components/Toasts.jsx';
import { Monogram } from '../components/Ornaments.jsx';

import Login from './Login.jsx';
import ChangePassword from './ChangePassword.jsx';
import Dashboard from './Dashboard.jsx';
import AdminProducts from './Products.jsx';
import AdminOrders from './Orders.jsx';
import AdminBookings from './Bookings.jsx';
import AdminBanners from './Banners.jsx';
import AdminEvents from './Events.jsx';
import Appearance from './Appearance.jsx';
import AdminCustomers from './Customers.jsx';
import AdminReviews from './Reviews.jsx';
import AdminReturns from './Returns.jsx';
import AdminSlides from './Slides.jsx';
import AdminPages from './Pages.jsx';
import AdminConsultations from './Consultations.jsx';
import AdminCoupons from './Coupons.jsx';

const NAV_GROUPS = [
  {
    title: 'Selling',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/returns', label: 'Returns', icon: RotateCcw },
      { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    title: 'Consultations',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: PhoneCall },
      { to: '/admin/consultations', label: 'Types & availability', icon: Video },
      { to: '/admin/events', label: 'Event calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Storefront',
    items: [
      { to: '/admin/slides', label: 'Homepage carousel', icon: Images },
      { to: '/admin/banners', label: 'Banners & offers', icon: Megaphone },
      { to: '/admin/reviews', label: 'Reviews', icon: Star },
      { to: '/admin/pages', label: 'Pages & policies', icon: FileText },
      { to: '/admin/appearance', label: 'Design & theme', icon: Palette },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [pathname]);

  const logout = () => { setToken(null); navigate('/admin/login'); };

  const current = NAV.find((n) => (n.end ? n.to === pathname : pathname.startsWith(n.to)));

  const SideNav = (
    <>
      <Link to="/admin" className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 py-4">
        <Monogram size={32} />
        <span>
          <span className="block text-[0.95rem] font-semibold leading-none">Sukoon</span>
          <span className="mt-1 block text-[0.62rem] text-muted">Store admin</span>
        </span>
      </Link>

      {/* min-h-0 is what actually lets this scroll: without it the flex child
          refuses to shrink below its content and the overflow never engages. */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className={gi ? 'mt-5' : ''}>
            <p className="px-3 pb-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-muted/70">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[var(--r-btn)] px-3 py-2 text-[0.85rem] transition-colors ${
                      isActive ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-bg2 hover:text-ink'
                    }`
                  }
                >
                  <Icon size={15} strokeWidth={1.7} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-line p-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[var(--r-btn)] px-3 py-2.5 text-[0.86rem] text-muted transition-colors hover:bg-bg2 hover:text-ink">
          <ExternalLink size={16} strokeWidth={1.7} /> View live site
        </a>
        <NavLink to="/admin/password" className="flex w-full items-center gap-3 rounded-[var(--r-btn)] px-3 py-2.5 text-[0.86rem] text-muted transition-colors hover:bg-bg2 hover:text-ink">
          <KeyRound size={16} strokeWidth={1.7} /> Change password
        </NavLink>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-[var(--r-btn)] px-3 py-2.5 text-[0.86rem] text-muted transition-colors hover:bg-sale/8 hover:text-sale">
          <LogOut size={16} strokeWidth={1.7} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-60 flex-col border-r border-line bg-surface lg:flex">
        {SideNav}
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute inset-y-0 left-0 flex h-full w-64 flex-col border-r border-line bg-surface"
            >
              {SideNav}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur-sm lg:px-7">
          <button onClick={() => setOpen(true)} className="rounded-[var(--r-btn)] p-2 hover:bg-bg2 lg:hidden" aria-label="Menu">
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium">{current?.label || 'Admin'}</h1>
            <p className="text-[0.72rem] text-muted">Sukoon Crystal Solutions</p>
          </div>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-ok/30 bg-ok/8 px-3 py-1 text-[0.72rem] text-ok sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Store online
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-[0.82rem] font-semibold text-brand">SK</span>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-7">{children}</main>
      </div>
      <Toasts />
    </div>
  );
}

function Guard({ children }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route index element={<Guard><Dashboard /></Guard>} />
      <Route path="products" element={<Guard><AdminProducts /></Guard>} />
      <Route path="orders" element={<Guard><AdminOrders /></Guard>} />
      <Route path="bookings" element={<Guard><AdminBookings /></Guard>} />
      <Route path="events" element={<Guard><AdminEvents /></Guard>} />
      <Route path="banners" element={<Guard><AdminBanners /></Guard>} />
      <Route path="appearance" element={<Guard><Appearance /></Guard>} />
      <Route path="customers" element={<Guard><AdminCustomers /></Guard>} />
      <Route path="returns" element={<Guard><AdminReturns /></Guard>} />
      <Route path="reviews" element={<Guard><AdminReviews /></Guard>} />
      <Route path="slides" element={<Guard><AdminSlides /></Guard>} />
      <Route path="pages" element={<Guard><AdminPages /></Guard>} />
      <Route path="consultations" element={<Guard><AdminConsultations /></Guard>} />
      <Route path="coupons" element={<Guard><AdminCoupons /></Guard>} />
      <Route path="password" element={<Guard><ChangePassword /></Guard>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
