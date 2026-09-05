import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, Outlet } from 'react-router-dom';

import { ShopProvider, useVisitTracker } from './lib/store.jsx';
import { AccountProvider } from './lib/account.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import WhatsAppButton from './components/WhatsAppButton.jsx';
import Toasts from './components/Toasts.jsx';
import { TopBanner } from './components/Banners.jsx';

import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Checkout from './pages/Checkout.jsx';
import Book from './pages/Book.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import Track from './pages/Track.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import PolicyPage from './pages/PolicyPage.jsx';
import Account from './pages/Account.jsx';
import BirthChart from './pages/BirthChart.jsx';
import NotFound from './pages/NotFound.jsx';

/* Each policy gets its own top-level URL rather than sitting under /pages/*,
   because these are the addresses the footer, invoices and payment gateways
   link to and they should read as first-class pages. */
const POLICY_HANDLES = [
  'privacy-policy',
  'terms-of-service',
  'shipping-policy',
  'return-refund-policy',
  'faq',
];

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function StoreLayout() {
  const { pathname } = useLocation();
  useVisitTracker(pathname);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  /* `shell` carries the Studio sidebar offset; --sidebar is 0 elsewhere. */
  return (
    <div className="shell flex min-h-screen flex-col">
      <TopBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
      <Toasts />
    </div>
  );
}

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
    </div>
  );
}

export default function App() {
  return (
    <ShopProvider>
      <AccountProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:category" element={<Shop />} />
              <Route path="/product/:slug" element={<Product />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/book" element={<Book />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/track" element={<Track />} />
              <Route path="/account" element={<Account />} />
              <Route path="/birth-chart" element={<BirthChart />} />
              {POLICY_HANDLES.map((h) => (
                <Route key={h} path={`/${h}`} element={<PolicyPage handle={h} />} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </Suspense>
      </AccountProvider>
    </ShopProvider>
  );
}
