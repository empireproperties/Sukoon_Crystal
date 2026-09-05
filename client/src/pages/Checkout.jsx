import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShieldCheck, Truck, Tag, ArrowRight, Copy, Lock, ChevronRight } from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { useAccount } from '../lib/account.jsx';
import ProductImage from '../components/ProductImage.jsx';
import AddressFields from '../components/AddressFields.jsx';

const RZP_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/* Razorpay's widget is loaded on demand, once, and only if online payment is on. */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const el = document.createElement('script');
    el.src = RZP_SCRIPT;
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.body.appendChild(el);
  });
}

export default function Checkout() {
  const { cart, subtotal, shipping, clearCart, toast } = useShop();
  const { user } = useAccount() || {};
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '' });
  const [payment, setPayment] = useState('Prepaid');
  const [coupon, setCoupon] = useState('');
  /* { code, discount } once the server has confirmed it. */
  const [applied, setApplied] = useState(null);
  const [checking, setChecking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState(null);
  const [online, setOnline] = useState(false);
  const [editDetails, setEditDetails] = useState(false);

  /* Whether the server has Razorpay keys decides if "Pay online" is real. */
  useEffect(() => {
    api.paymentConfig().then((c) => setOnline(Boolean(c.razorpay))).catch(() => setOnline(false));
  }, []);

  /* Fill from the signed-in profile so a returning shopper is not asked for
     details the account already holds. Only fills blanks, so anything typed on
     this page survives a profile load. */
  useEffect(() => {
    if (!user) return;
    const a = user.addresses?.[0] || {};
    setForm((f) => ({
      ...f,
      name: f.name || user.name || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phone || '',
      address: f.address || a.address || a.line || '',
      city: f.city || a.city || '',
      state: f.state || a.state || '',
      pincode: f.pincode || a.pincode || '',
    }));
  }, [user]);

  const discount = applied?.discount || 0;
  const total = subtotal + shipping - discount;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* The server prices the code against this exact cart, so what is shown here
     is what will actually be charged. */
  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    try {
      const res = await api.checkCoupon({ items: lines(), code });
      setApplied({ code: res.code, discount: res.discount });
      toast(`${res.code} applied — ${inr(res.discount)} off`, 'success');
    } catch (e) {
      setApplied(null);
      toast(e.message, 'warn');
    } finally {
      setChecking(false);
    }
  };

  const clearCoupon = () => { setApplied(null); setCoupon(''); };

  /* A profile that already has everything needed to ship. */
  const prefilled = Boolean(user && form.name && form.phone && form.address && form.city && form.pincode);

  const lines = () => cart.map((l) => ({ productId: l.productId, slug: l.slug, qty: l.qty }));

  const settle = (created) => {
    setOrder(created);
    clearCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* Online payment: the server prices the cart and opens a Razorpay order, the
     widget takes the money, and the server verifies the signature before any
     order exists. The browser never decides what was paid. */
  const payOnline = async () => {
    const ready = await loadRazorpay();
    if (!ready) throw new Error('Could not reach the payment gateway. Check your connection and try again.');

    const intent = await api.createPayment({ items: lines(), customer: form, couponCode: applied?.code || '' });

    await new Promise((resolve, reject) => {
      /* Razorpay closes its modal the instant a payment succeeds, which fires
         `ondismiss`. The success handler is async — it has to round-trip to our
         server to verify the signature — so `ondismiss` reached `reject` first
         and the promise settled as "Payment cancelled" on a payment that had
         actually gone through. A promise settles once, so the reject won.
         This flag is set synchronously the moment Razorpay hands back a
         payment, before any await, so the dismiss handler knows to stay quiet. */
      let handled = false;

      const rzp = new window.Razorpay({
        key: intent.keyId,
        order_id: intent.razorpayOrderId,
        amount: intent.amount,
        currency: intent.currency,
        name: 'Sukoon Crystal Solutions',
        description: `${cart.length} item${cart.length > 1 ? 's' : ''}`,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        notes: { address: form.address, city: form.city },
        theme: { color: '#4b5296' },
        handler: async (response) => {
          handled = true;
          try {
            settle(await api.verifyPayment(response));
            resolve();
          } catch (err) {
            /* The money has left the customer's account at this point, so this
               must never read like a plain failure they should retry. */
            reject(new Error(
              `${err.message || 'We could not confirm that payment.'} `
              + 'Your payment may have gone through — please contact us on +91 90122 57555 '
              + 'with your payment id before trying again.'
            ));
          }
        },
        modal: {
          ondismiss: () => {
            if (handled) return;
            reject(new Error('Payment cancelled — your cart is still here.'));
          },
        },
      });
      rzp.on('payment.failed', (r) => {
        if (handled) return;
        handled = true;
        reject(new Error(r?.error?.description || 'The payment did not go through.'));
      });
      rzp.open();
    });
  };

  const place = async (e) => {
    e.preventDefault();
    if (!cart.length) return;
    setPlacing(true);
    try {
      if (payment === 'Prepaid' && online) {
        await payOnline();
      } else {
        settle(await api.placeOrder({ items: lines(), customer: form, payment, couponCode: applied?.code || '' }));
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  /* ------------------------------------------------------ confirmation */
  if (order) {
    return (
      <div className="wrap py-14">
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/10 text-ok">
            <Check size={30} strokeWidth={2.2} />
          </motion.div>

          <h1 className="mt-6 text-center text-3xl">Thank you — your order is confirmed</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-[0.92rem] leading-relaxed text-muted">
            We have emailed the details to <strong className="text-ink">{order.customer.email}</strong>.
            Your stones will be cleansed, charged and packed by hand within 48 hours.
          </p>

          <div className="mt-8 border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <p className="text-[0.72rem] text-muted">Order number</p>
                <p className="mt-0.5 text-xl font-semibold tnum">{order.number}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(order.number); toast('Order number copied', 'success'); }}
                className="btn btn-outline btn-sm"
              >
                <Copy size={13} /> Copy
              </button>
            </div>

            <dl className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ['Order total', inr(order.total)],
                ['Payment method', order.payment],
                ['Courier', order.courier],
                ['Tracking number', order.awb],
                ['Delivering to', `${order.customer.city}, ${order.customer.state} ${order.customer.pincode}`],
                ['Expected dispatch', 'Within 48 hours'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[0.72rem] text-muted">{k}</dt>
                  <dd className="mt-0.5 text-[0.88rem]">{v}</dd>
                </div>
              ))}
            </dl>

            <ul className="divide-y divide-line border-t border-line">
              {order.items.map((it, i) => (
                <li key={i} className="flex items-center gap-4 p-4">
                  <ProductImage product={{ name: it.name, image: it.image }} className="h-14 w-14 shrink-0" imgClassName="rounded-[var(--r-btn)]" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[0.86rem]">{it.name}</p>
                    <p className="text-[0.75rem] text-muted">Qty {it.qty}</p>
                  </div>
                  <span className="text-[0.88rem] tnum">{inr(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={`/track?number=${order.number}`} className="btn btn-primary">
              Track this order <ArrowRight size={14} />
            </Link>
            <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- empty cart */
  if (!cart.length) {
    return (
      <div className="grid min-h-[55vh] place-items-center px-5 text-center">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl">Your cart is empty</h1>
          <p className="mt-2 text-[0.9rem] text-muted">Add a piece first, or book a free call and let Swati choose.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/shop" className="btn btn-primary">Shop all crystals</Link>
            <Link to="/book" className="btn btn-outline">Book a call</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- form */
  return (
    <>
      <div className="border-b border-line bg-bg2">
        <div className="wrap py-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-[0.76rem] text-muted">
            <Link to="/shop" className="hover:text-brand">Shop</Link>
            <ChevronRight size={12} className="opacity-50" />
            <span className="text-ink">Checkout</span>
          </nav>
          <h1 className="mt-2 text-3xl">Checkout</h1>
        </div>
      </div>

      <form onSubmit={place} className="wrap grid gap-10 py-9 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-8">
          {/* contact + address */}
          <section className="border border-line bg-surface p-6 sm:p-7" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Delivery details</h2>
              {prefilled && !editDetails && (
                <button type="button" onClick={() => setEditDetails(true)}
                  className="text-[0.82rem] text-muted underline underline-offset-2 hover:text-brand">
                  Change
                </button>
              )}
            </div>

            {/* A signed-in shopper whose profile already has everything is shown
                it back as a summary instead of being made to retype it. That
                re-asking was the worst part of the old flow. */}
            {prefilled && !editDetails && (
              <div className="mt-4 border border-line bg-bg2 p-4" style={{ borderRadius: 'var(--r-btn)' }}>
                <p className="text-[0.9rem] font-medium">{form.name}</p>
                <p className="mt-0.5 text-[0.84rem] text-muted">{form.phone}{form.email ? ` · ${form.email}` : ''}</p>
                <p className="mt-2 text-[0.84rem] leading-relaxed text-muted">
                  {[form.address, form.city, form.state, form.pincode].filter(Boolean).join(', ')}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-[0.76rem] text-ok">
                  <Check size={12} strokeWidth={2.4} /> From your account
                </p>
              </div>
            )}
            <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${prefilled && !editDetails ? 'hidden' : ''}`}>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="co-name">Full name</label>
                <input id="co-name" required value={form.name} onChange={set('name')} className="field" placeholder="Ananya Sharma" autoComplete="name" />
              </div>
              <div>
                <label className="field-label" htmlFor="co-phone">Phone number</label>
                <input id="co-phone" required value={form.phone} onChange={set('phone')} className="field" placeholder="+91 90000 00000" autoComplete="tel" />
              </div>
              <div>
                <label className="field-label" htmlFor="co-email">Email address</label>
                <input id="co-email" required type="email" value={form.email} onChange={set('email')} className="field" placeholder="you@email.com" autoComplete="email" />
              </div>
              {/* Same component the profile uses, so "use my location" and the
                  PIN auto-fill behave identically in both places. */}
              <AddressFields
                idPrefix="co"
                value={form}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
            </div>
          </section>

          {/* payment */}
          <section className="border border-line bg-surface p-6 sm:p-7" style={{ borderRadius: 'var(--r-card)' }}>
            <h2 className="text-lg font-medium">Payment method</h2>
            <div className="mt-5 space-y-3">
              {[
                { id: 'Prepaid', title: 'Pay online', sub: online ? 'UPI, credit or debit card, net banking — secured by Razorpay' : 'Currently unavailable' },
                { id: 'COD', title: 'Cash on delivery', sub: 'Available on orders above ₹500' },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-start gap-3.5 border p-4 transition-colors ${
                    payment === m.id ? 'border-brand bg-brand-soft' : 'border-line hover:border-muted'
                  }`}
                  style={{ borderRadius: 'var(--r-card)' }}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === m.id}
                    onChange={() => setPayment(m.id)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border ${
                    payment === m.id ? 'border-brand bg-brand text-white' : 'border-line'
                  }`} style={{ width: 18, height: 18 }}>
                    {payment === m.id && <Check size={10} strokeWidth={3.5} />}
                  </span>
                  <span>
                    <span className="block text-[0.92rem] font-medium">{m.title}</span>
                    <span className="block text-[0.8rem] text-muted">{m.sub}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[0.76rem] text-muted">
              <Lock size={12} strokeWidth={1.8} />
              {online
                ? 'Payments are processed by Razorpay. Card details never touch our servers.'
                : 'Online payment is not enabled yet — cash on delivery only.'}
            </p>
          </section>
        </div>

        {/* --------------------------------------------------------- summary */}
        <aside>
          <div className="lg:sticky lg:top-6">
            <div className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
              <h2 className="border-b border-line px-5 py-4 text-lg font-medium">Order summary</h2>

              <ul className="divide-y divide-line">
                {cart.map((l) => (
                  <li key={l.productId} className="flex items-center gap-3.5 px-5 py-3.5">
                    <ProductImage product={{ name: l.name, image: l.image }} className="h-14 w-12 shrink-0" imgClassName="rounded-[var(--r-btn)]" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[0.84rem] leading-snug">{l.name}</p>
                      <p className="text-[0.74rem] text-muted">Qty {l.qty}</p>
                    </div>
                    <span className="shrink-0 text-[0.86rem] tnum">{inr(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line p-5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                      placeholder="Coupon code"
                      className="field !pl-8 uppercase"
                      aria-label="Coupon code"
                    />
                  </div>
                  <button type="button" onClick={applyCoupon} disabled={checking || !coupon.trim()}
                    className="btn btn-outline shrink-0 disabled:opacity-40">
                    {checking ? '…' : 'Apply'}
                  </button>
                </div>
                <AnimatePresence>
                  {applied && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-ok">
                      <Check size={12} strokeWidth={2.4} /> {applied.code} applied — {inr(applied.discount)} off
                      <button type="button" onClick={clearCoupon} className="ml-auto text-muted underline underline-offset-2 hover:text-ink">
                        Remove
                      </button>
                    </motion.p>
                  )}
                </AnimatePresence>

                <dl className="mt-5 space-y-2 text-[0.88rem]">
                  <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{inr(subtotal)}</dd></div>
                  {discount > 0 && (
                    <div className="flex justify-between text-ok"><dt>Discount</dt><dd className="tnum">− {inr(discount)}</dd></div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping</dt>
                    <dd className={shipping === 0 ? 'text-ok' : 'tnum'}>{shipping === 0 ? 'Free' : inr(shipping)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3 text-[1.05rem] font-semibold">
                    <dt>Total</dt><dd className="tnum">{inr(total)}</dd>
                  </div>
                </dl>

                <button type="submit" disabled={placing} className="btn btn-primary btn-lg mt-5 w-full">
                  {placing ? 'Placing your order…' : `Place order · ${inr(total)}`}
                </button>

                <ul className="mt-4 space-y-2 text-[0.76rem] text-muted">
                  <li className="flex gap-2"><Truck size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-accent" /> Dispatched within 48 hours of charging</li>
                  <li className="flex gap-2"><ShieldCheck size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-accent" /> Seven-day replacement on breakage</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </>
  );
}
