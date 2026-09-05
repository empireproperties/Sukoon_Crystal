import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Package, ChevronDown, RotateCcw, Truck, MapPin, ArrowRight } from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useAccount } from '../lib/account.jsx';
import { useShop } from '../lib/store.jsx';
import OrderTimeline, { flowIndex } from '../components/OrderTimeline.jsx';
import ReturnDialog from '../components/ReturnDialog.jsx';

const STATUS_LABEL = {
  placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed',
  in_transit: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled',
};

/* The pill carries the state at a glance, so the row can be scanned without
   opening anything. */
function StatusPill({ status }) {
  const tone = status === 'delivered' ? 'bg-brand/10 text-brand'
    : status === 'cancelled' ? 'bg-sale/10 text-sale'
    : status === 'in_transit' ? 'bg-accent/15 text-accent'
    : 'bg-bg2 text-muted';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] ${tone}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function OrderRow({ order, open, onToggle, onReturn, returnable }) {
  const items = order.items || [];
  const eta = flowIndex(order.status);

  return (
    <div className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
      >
        {items[0]?.image ? (
          <img src={items[0].image} alt="" className="h-14 w-14 shrink-0 rounded object-cover" loading="lazy" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded bg-bg2 text-muted">
            <Package size={18} strokeWidth={1.6} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[0.9rem] font-medium">{order.number}</span>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 truncate text-[0.8rem] text-muted">
            {items.length ? items[0].name : 'Order'}
            {items.length > 1 ? ` + ${items.length - 1} more` : ''}
          </p>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            {dateLabel(order.createdAt)} · {inr(order.total)}
          </p>
        </div>

        <ChevronDown
          size={17}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line p-4 sm:p-5">
              <OrderTimeline order={order} />

              {order.status !== 'cancelled' && eta >= 0 && (
                <p className="mt-5 flex items-center gap-2 text-[0.82rem] text-muted">
                  {order.status === 'delivered'
                    ? <><Package size={13} /> Delivered{order.deliveredAt ? ` on ${dateLabel(order.deliveredAt)}` : ''}</>
                    : <><Truck size={13} /> {order.courier || 'Courier'}{order.awb ? ` · ${order.awb}` : ''}</>}
                </p>
              )}

              <ul className="mt-5 space-y-2 border-t border-line pt-4">
                {items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 text-[0.84rem]">
                    <span className="truncate text-muted">{it.name} × {it.qty}</span>
                    <span className="shrink-0 tnum">{inr((it.price || 0) * (it.qty || 1))}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[0.84rem]">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{inr(order.subtotal)}</dd></div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-ok">
                    <dt>Discount{order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt>
                    <dd className="tnum">− {inr(order.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tnum">{order.shipping ? inr(order.shipping) : 'Free'}</dd></div>
                <div className="flex justify-between pt-1 font-medium"><dt>Total</dt><dd className="tnum">{inr(order.total)}</dd></div>
              </dl>

              {order.customer?.address && (
                <p className="mt-4 flex gap-2 border-t border-line pt-4 text-[0.8rem] leading-relaxed text-muted">
                  <MapPin size={13} className="mt-0.5 shrink-0" />
                  {[order.customer.address, order.customer.city, order.customer.state, order.customer.pincode].filter(Boolean).join(', ')}
                </p>
              )}

              {/* Returns only make sense once it has arrived, and the server
                  decides eligibility — this just reflects what it said. */}
              {returnable?.ok && (
                <button onClick={() => onReturn(order)} className="btn mt-4 w-full border border-line sm:w-auto">
                  <RotateCcw size={14} /> Return this order · {returnable.daysLeft} day(s) left
                </button>
              )}
              {order.status === 'delivered' && returnable && !returnable.ok && (
                <p className="mt-4 text-[0.78rem] text-muted">{returnable.reason}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Track() {
  const { user, loading } = useAccount() || {};
  const { toast } = useShop();
  const [params] = useSearchParams();

  const [orders, setOrders] = useState(null);
  const [eligibility, setEligibility] = useState({});
  const [openId, setOpenId] = useState(null);
  const [returning, setReturning] = useState(null);

  /* Guest lookup by order number, for anyone who checked out without an account. */
  const [number, setNumber] = useState(params.get('number') || '');
  const [guestOrder, setGuestOrder] = useState(null);
  const [searching, setSearching] = useState(false);

  const loadMine = async () => {
    const list = await api.myOrders().catch(() => []);
    setOrders(list);
    if (list.length) setOpenId((id) => id || list[0].id);
    const checks = await Promise.all(
      list.filter((o) => o.status === 'delivered')
        .map((o) => api.returnable(o.id).then((r) => [o.id, r]).catch(() => [o.id, { ok: false }]))
    );
    setEligibility(Object.fromEntries(checks));
  };

  useEffect(() => { if (user) loadMine(); /* eslint-disable-next-line */ }, [user]);

  const lookup = async (e) => {
    e?.preventDefault();
    const n = number.trim();
    if (!n) return;
    setSearching(true);
    try {
      setGuestOrder(await api.track(n));
    } catch (err) {
      setGuestOrder(null);
      toast(err.message, 'warn');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => { if (params.get('number')) lookup(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="wrap max-w-3xl py-10 sm:py-14">
      <h1 className="text-[1.6rem] sm:text-[2rem]">Your orders</h1>
      <p className="mt-1.5 text-[0.88rem] text-muted">
        {user ? 'Tap an order to see where it is.' : 'Sign in to see all your orders, or look one up by number.'}
      </p>

      {/* -------------------------------------------------- signed-in list */}
      {user && (
        <div className="mt-7">
          {!orders ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded bg-bg2" />)}</div>
          ) : !orders.length ? (
            <div className="border border-line bg-bg2 p-8 text-center" style={{ borderRadius: 'var(--r-card)' }}>
              <Package size={24} className="mx-auto text-muted" strokeWidth={1.5} />
              <p className="mt-3 text-[0.92rem] font-medium">No orders yet</p>
              <Link to="/shop" className="btn btn-primary mt-5">Start shopping <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  open={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onReturn={setReturning}
                  returnable={eligibility[o.id]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------- guest lookup by number */}
      {!user && !loading && (
        <>
          <form onSubmit={lookup} className="mt-7 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Order number, e.g. SKN1042"
                aria-label="Order number"
                className="field !pl-10"
              />
            </div>
            <button className="btn btn-primary shrink-0" disabled={searching || !number.trim()}>
              {searching ? 'Finding…' : 'Track'}
            </button>
          </form>

          {guestOrder && (
            <div className="mt-5">
              <OrderRow order={guestOrder} open onToggle={() => {}} onReturn={() => {}} returnable={null} />
              <p className="mt-3 text-[0.8rem] text-muted">
                <Link to="/account" className="text-brand underline underline-offset-2">Create an account</Link>
                {' '}with this email to see every order in one place and raise returns.
              </p>
            </div>
          )}
        </>
      )}

      {returning && (
        <ReturnDialog
          order={returning}
          onClose={() => setReturning(null)}
          onDone={loadMine}
        />
      )}
    </div>
  );
}
