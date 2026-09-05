import { createContext, useContext, useEffect, useMemo, useReducer, useState, useCallback } from 'react';
import { api } from './api.js';
import { normalise } from '../theme/designs.js';

/* ------------------------------------------------------------------ cart */
const CART_KEY = 'sukoon_cart';
const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const found = state.find((l) => l.productId === action.product.id);
      const qty = action.qty || 1;
      if (found) return state.map((l) => (l.productId === action.product.id ? { ...l, qty: l.qty + qty } : l));
      const p = action.product;
      return [...state, {
        productId: p.id, slug: p.slug, name: p.name, price: p.price, mrp: p.mrp,
        image: p.images?.[0] || '', stone: p.stone, qty,
      }];
    }
    case 'qty':
      return state
        .map((l) => (l.productId === action.id ? { ...l, qty: Math.max(0, action.qty) } : l))
        .filter((l) => l.qty > 0);
    case 'remove':
      return state.filter((l) => l.productId !== action.id);
    case 'clear':
      return [];
    default:
      return state;
  }
}

/* ------------------------------------------------------------ recently viewed */
const SEEN_KEY = 'sukoon_seen';
const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; }
};

/* --------------------------------------------------------------- context */
const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);

export function ShopProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, readCart);
  const [settings, setSettings] = useState(null);
  const [banners, setBanners] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);

  const [theme, setThemeState] = useState(() =>
    normalise(document.documentElement.dataset.design, document.documentElement.dataset.palette)
  );

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  /** Stamps the pair on <html>; every token in the CSS follows from it. */
  const applyTheme = useCallback((designId, paletteId) => {
    const next = normalise(designId, paletteId);
    document.documentElement.setAttribute('data-design', next.design.id);
    document.documentElement.setAttribute('data-palette', next.palette.id);
    setThemeState(next);
    return next;
  }, []);

  const refreshSettings = useCallback(async () => {
    const [s, b] = await Promise.all([
      api.settings().catch(() => null),
      api.banners().catch(() => null),
    ]);
    if (s) { setSettings(s); applyTheme(s.design, s.palette); }
    if (b) setBanners(b);
    return s;
  }, [applyTheme]);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  const toast = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const remember = useCallback((product) => {
    if (!product?.id) return;
    setSeen((prev) => {
      const next = [
        { id: product.id, slug: product.slug, name: product.name, price: product.price, image: product.images?.[0] || '' },
        ...prev.filter((p) => p.id !== product.id),
      ].slice(0, 8);
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const count = cart.reduce((t, l) => t + l.qty, 0);
    const subtotal = cart.reduce((t, l) => t + l.price * l.qty, 0);
    return {
      cart, count, subtotal,
      shipping: subtotal === 0 ? 0 : subtotal >= 999 ? 0 : 60,
      addToCart: (product, qty) => { dispatch({ type: 'add', product, qty }); setDrawerOpen(true); },
      setQty: (id, qty) => dispatch({ type: 'qty', id, qty }),
      removeFromCart: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clear' }),
      drawerOpen, setDrawerOpen,
      settings, refreshSettings,
      theme, design: theme.design.id, palette: theme.palette.id, applyTheme,
      banners,
      toasts, toast,
      seen, remember,
    };
  }, [cart, drawerOpen, settings, banners, toasts, toast, refreshSettings, applyTheme, theme, seen, remember]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

/* -------------------------------------------------------- visit tracking */
const SESSION_KEY = 'sukoon_session';
export function useVisitTracker(pathname) {
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    let session = sessionStorage.getItem(SESSION_KEY);
    if (!session) {
      session = `s_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      sessionStorage.setItem(SESSION_KEY, session);
    }
    const ref = document.referrer || '';
    const source = ref.includes('instagram') ? 'Instagram'
      : ref.includes('google') ? 'Google'
      : ref.includes('facebook') ? 'Facebook'
      : ref ? 'Referral' : 'Direct';
    const w = window.innerWidth;
    api.trackVisit({
      path: pathname,
      session,
      source,
      device: w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
      /* True whenever the page is being driven by a script rather than a
         person. Sent so the server can leave test runs and scrapers out of the
         visit count. */
      automated: navigator.webdriver === true,
    });
  }, [pathname]);
}

/* ------------------------------------------------------------ utilities */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fn())
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error: error.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: d })) };
}
