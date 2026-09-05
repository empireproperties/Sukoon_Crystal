import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Trash2, ShoppingBag, Truck, ShieldCheck } from 'lucide-react';

import { useShop } from '../lib/store.jsx';
import { inr } from '../lib/api.js';
import ProductImage from './ProductImage.jsx';

export default function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, setQty, removeFromCart, subtotal, shipping, count } = useShop();
  const toFree = Math.max(0, 999 - subtotal);
  const progress = Math.min(100, (subtotal / 999) * 100);

  /* Escape closes it, and the page behind stops scrolling while it is open —
     scrolling the catalogue under an open cart is disorienting on a laptop and
     makes the drawer feel detached from the page. */
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75]">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            role="dialog"
            aria-label="Shopping cart"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-medium">
                Your cart <span className="text-muted">({count})</span>
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="rounded-[var(--r-btn)] p-2 transition-colors hover:bg-bg2" aria-label="Close cart">
                <X size={19} strokeWidth={1.6} />
              </button>
            </header>

            {cart.length > 0 && (
              <div className="border-b border-line px-5 py-3.5">
                <p className="flex items-center gap-2 text-[0.78rem]">
                  <Truck size={14} strokeWidth={1.7} className="text-accent" />
                  {toFree > 0 ? (
                    <span className="text-muted">Add <strong className="text-ink">{inr(toFree)}</strong> more for free shipping</span>
                  ) : (
                    <span className="text-ok">You have unlocked free shipping</span>
                  )}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg2">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <ShoppingBag size={34} strokeWidth={1.2} className="text-muted" />
                  <p className="mt-4 text-lg font-medium">Your cart is empty</p>
                  <p className="mt-1.5 text-[0.86rem] text-muted">
                    Browse the collections, or book a free call and let Swati choose for you.
                  </p>
                  <Link to="/shop" onClick={() => setDrawerOpen(false)} className="btn btn-primary mt-6">
                    Shop all crystals
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>
                    {cart.map((line) => (
                      <motion.li
                        key={line.productId}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.2 }}
                        className="flex gap-4 p-5"
                      >
                        <Link to={`/product/${line.slug}`} onClick={() => setDrawerOpen(false)} className="shrink-0">
                          <ProductImage
                            product={{ name: line.name, image: line.image }}
                            className="h-24 w-20"
                            imgClassName="rounded-[var(--r-btn)]"
                          />
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link to={`/product/${line.slug}`} onClick={() => setDrawerOpen(false)}>
                            <h3 className="line-clamp-2 text-[0.88rem] font-medium leading-snug hover:text-brand">{line.name}</h3>
                          </Link>
                          <p className="mt-0.5 line-clamp-1 text-[0.75rem] text-muted">{line.stone}</p>

                          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                            <div className="flex items-center border border-line" style={{ borderRadius: 'var(--r-btn)' }}>
                              <button onClick={() => setQty(line.productId, line.qty - 1)} className="grid h-8 w-8 place-items-center text-muted hover:text-ink" aria-label="Decrease quantity">
                                <Minus size={13} />
                              </button>
                              <span className="w-7 text-center text-[0.85rem] tnum">{line.qty}</span>
                              <button onClick={() => setQty(line.productId, line.qty + 1)} className="grid h-8 w-8 place-items-center text-muted hover:text-ink" aria-label="Increase quantity">
                                <Plus size={13} />
                              </button>
                            </div>
                            <span className="text-[0.9rem] font-semibold tnum">{inr(line.price * line.qty)}</span>
                            <button onClick={() => removeFromCart(line.productId)} className="text-muted transition-colors hover:text-sale" aria-label={`Remove ${line.name}`}>
                              <Trash2 size={15} strokeWidth={1.6} />
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <footer className="space-y-4 border-t border-line bg-bg2 px-5 py-5">
                <dl className="space-y-1.5 text-[0.88rem]">
                  <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{inr(subtotal)}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping</dt>
                    <dd className={shipping === 0 ? 'text-ok' : 'tnum'}>{shipping === 0 ? 'Free' : inr(shipping)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-[1rem] font-semibold">
                    <dt>Total</dt><dd className="tnum">{inr(subtotal + shipping)}</dd>
                  </div>
                </dl>

                <Link to="/checkout" onClick={() => setDrawerOpen(false)} className="btn btn-primary btn-lg w-full">
                  Proceed to checkout
                </Link>
                <p className="flex items-center justify-center gap-1.5 text-[0.72rem] text-muted">
                  <ShieldCheck size={12} strokeWidth={1.8} /> Secure checkout · Cash on delivery available
                </p>
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
