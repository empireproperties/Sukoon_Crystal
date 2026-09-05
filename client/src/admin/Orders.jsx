import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, ShoppingCart, Truck, CheckCircle2, Clock, Package, AlertTriangle,
  ChevronRight, MapPin, Phone, Mail, ArrowRight, ReceiptText,
} from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { SlideOver, ConfirmDelete, Field, EmptyState } from './ui.jsx';
import Invoice from './Invoice.jsx';

const FLOW = ['placed', 'confirmed', 'packed', 'in_transit', 'delivered'];

const META = {
  placed: { label: 'Placed', icon: Clock, colour: '#3d7fa3' },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, colour: '#4b5296' },
  packed: { label: 'Packed', icon: Package, colour: '#c47a35' },
  in_transit: { label: 'In transit', icon: Truck, colour: '#b0803a' },
  delivered: { label: 'Delivered', icon: CheckCircle2, colour: '#4a8a5f' },
  cancelled: { label: 'Cancelled', icon: AlertTriangle, colour: '#b4503c' },
};

const COURIERS = ['Delhivery', 'BlueDart', 'DTDC', 'India Post', 'Ekart'];

const StatusBadge = ({ status }) => {
  const m = META[status];
  if (!m) return null;
  return (
    <span className="badge" style={{ color: m.colour, borderColor: `${m.colour}44`, background: `${m.colour}10` }}>
      <m.icon size={10} strokeWidth={2} /> {m.label}
    </span>
  );
};

export default function AdminOrders() {
  const { toast } = useShop();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: orders = [], loading, reload } = useAsync(() => api.orders({ status, q }), [status, q]);
  const all = useAsync(() => api.orders({}), []);

  const counts = useMemo(() => {
    const src = all.data || [];
    return {
      all: src.length,
      ...Object.fromEntries(Object.keys(META).map((k) => [k, src.filter((o) => o.status === k).length])),
    };
  }, [all.data]);

  const revenue = useMemo(
    () => (orders || []).filter((o) => o.status !== 'cancelled').reduce((t, o) => t + o.total, 0),
    [orders]
  );

  const setStatus = (s) => {
    const next = new URLSearchParams(params);
    if (s === 'all') next.delete('status');
    else next.set('status', s);
    setParams(next, { replace: true });
  };

  const advance = async (order, to) => {
    setBusy(true);
    try {
      const updated = await api.updateOrder(order.id, { status: to });
      setOpen(updated);
      toast(`${order.number} marked ${META[to].label.toLowerCase()}.`, 'success');
      reload();
      all.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async (patch) => {
    const updated = await api.updateOrder(open.id, patch);
    setOpen(updated);
    reload();
  };

  const nextStatus = open ? FLOW[FLOW.indexOf(open.status) + 1] : null;

  return (
    <div className="space-y-6">
      {/* status filter rail */}
      <div className="flex flex-wrap gap-2">
        {[['all', 'All orders'], ...Object.entries(META).map(([k, v]) => [k, v.label])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`flex items-center gap-2 rounded-[var(--r-btn)] border px-3.5 py-2 text-[0.8rem] transition-colors ${
              status === key ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:border-brand hover:text-ink'
            }`}
          >
            {label}
            <span className="rounded-full bg-bg2 px-1.5 text-[0.68rem] tnum">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order number, name, phone, city or tracking number…"
            className="field !pl-9"
          />
        </div>
        <div className="text-right">
          <p className="text-[0.72rem] text-muted">Value of shown orders</p>
          <p className="text-xl font-semibold tnum">{inr(revenue)}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-14" style={{ borderRadius: 'var(--r-card)' }} />)}
        </div>
      ) : !orders.length ? (
        <EmptyState icon={ShoppingCart} title="No orders here" text="Nothing matches this filter yet." />
      ) : (
        <div className="overflow-hidden border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-line bg-bg2 text-left text-[0.72rem] font-medium text-muted">
                  {['Order', 'Customer', 'Items', 'Placed', 'Payment', 'Status', 'Total', ''].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.slice(0, 60).map((o, i) => (
                  <motion.tr
                    key={o.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.012, 0.3) }}
                    onClick={() => setOpen(o)}
                    className="table-row cursor-pointer"
                  >
                    <td className="px-5 py-3 text-[0.82rem] font-medium tnum">{o.number}</td>
                    <td className="px-5 py-3">
                      <p className="text-[0.86rem]">{o.customer.name}</p>
                      <p className="text-[0.72rem] text-muted">{o.customer.city}, {o.customer.state}</p>
                    </td>
                    <td className="px-5 py-3 text-[0.82rem] text-muted tnum">{o.items.length}</td>
                    <td className="px-5 py-3 text-[0.82rem] text-muted">
                      {dateLabel(o.createdAt, { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${o.payment === 'COD' ? 'badge-neutral' : 'badge-ok'}`}>{o.payment}</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-[0.86rem] font-medium tnum">{inr(o.total)}</td>
                    <td className="px-5 py-3"><ChevronRight size={15} className="text-muted" /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length > 60 && (
            <p className="border-t border-line px-5 py-3 text-center text-[0.76rem] text-muted">
              Showing the 60 most recent of {orders.length} matching orders.
            </p>
          )}
        </div>
      )}

      {invoiceFor && <Invoice orderId={invoiceFor} onClose={() => setInvoiceFor(null)} />}

      {/* ------------------------------------------------------ order detail */}
      <SlideOver
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Order ${open.number}` : ''}
        subtitle={open && dateLabel(open.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        footer={
          open && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setInvoiceFor(open.id)} className="btn border border-line">
                <ReceiptText size={14} /> Invoice
              </button>
              {nextStatus && open.status !== 'cancelled' && (
                <button onClick={() => advance(open, nextStatus)} disabled={busy} className="btn btn-primary flex-1">
                  Mark as {META[nextStatus].label.toLowerCase()} <ArrowRight size={14} />
                </button>
              )}
              {open.status !== 'cancelled' && open.status !== 'delivered' && (
                <button onClick={() => advance(open, 'cancelled')} className="btn btn-outline">Cancel order</button>
              )}
              <ConfirmDelete
                onConfirm={async () => {
                  await api.deleteOrder(open.id);
                  setOpen(null);
                  reload();
                  all.reload();
                  toast('Order deleted.', 'success');
                }}
              />
            </div>
          )
        }
      >
        {open && (
          <div className="space-y-7">
            {/* pipeline */}
            <div>
              <p className="field-label">Fulfilment stage</p>
              {open.status === 'cancelled' ? (
                <div className="border border-sale/30 bg-sale/5 p-4 text-[0.86rem] text-sale" style={{ borderRadius: 'var(--r-card)' }}>
                  This order was cancelled.
                </div>
              ) : (
                <>
                  <div className="flex items-center">
                    {FLOW.map((s, i) => {
                      const idx = FLOW.indexOf(open.status);
                      const done = i <= idx;
                      const Icon = META[s].icon;
                      return (
                        <div key={s} className="flex flex-1 items-center last:flex-none">
                          <button
                            onClick={() => advance(open, s)}
                            title={`Set to ${META[s].label}`}
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
                              done ? 'border-brand bg-brand text-onbrand' : 'border-line bg-surface text-muted hover:border-brand'
                            }`}
                          >
                            <Icon size={15} strokeWidth={1.8} />
                          </button>
                          {i < FLOW.length - 1 && (
                            <span className="mx-1 h-px flex-1 bg-line">
                              <motion.span
                                className="block h-full bg-brand"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: i < idx ? 1 : 0 }}
                                style={{ transformOrigin: 'left' }}
                                transition={{ duration: 0.3 }}
                              />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[0.76rem] text-muted">
                    Click any step to move the order there. The customer's tracking page updates immediately.
                  </p>
                </>
              )}
            </div>

            {/* customer */}
            <div className="border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <p className="field-label">Customer</p>
              <p className="text-[1.02rem] font-medium">{open.customer.name}</p>
              <ul className="mt-3 space-y-2 text-[0.83rem] text-muted">
                <li className="flex items-center gap-2.5"><Phone size={13} strokeWidth={1.7} className="text-accent" /> {open.customer.phone}</li>
                <li className="flex items-center gap-2.5"><Mail size={13} strokeWidth={1.7} className="text-accent" /> {open.customer.email}</li>
                <li className="flex gap-2.5">
                  <MapPin size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-accent" />
                  <span>{open.customer.address}, {open.customer.city}, {open.customer.state} — {open.customer.pincode}</span>
                </li>
              </ul>
            </div>

            {/* items */}
            <div>
              <p className="field-label">Items</p>
              <ul className="divide-y divide-line border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
                {open.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-3.5 p-3.5">
                    <ProductImage product={{ name: it.name, image: it.image }} className="h-12 w-12 shrink-0" imgClassName="rounded-[var(--r-btn)]" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[0.86rem]">{it.name}</p>
                      <p className="text-[0.74rem] text-muted">{inr(it.price)} × {it.qty}</p>
                    </div>
                    <span className="text-[0.86rem] font-medium tnum">{inr(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 text-[0.86rem]">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{inr(open.subtotal)}</dd></div>
                {open.discount > 0 && (
                  <div className="flex justify-between text-ok"><dt>Discount</dt><dd className="tnum">− {inr(open.discount)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tnum">{open.shipping ? inr(open.shipping) : 'Free'}</dd></div>
                <div className="flex justify-between border-t border-line pt-2.5 text-[1rem] font-semibold">
                  <dt>Total</dt><dd className="tnum">{inr(open.total)}</dd>
                </div>
              </dl>
            </div>

            {/* shipping meta */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Courier">
                <select value={open.courier} onChange={(e) => saveMeta({ courier: e.target.value })} className="field">
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Tracking number">
                <input defaultValue={open.awb} onBlur={(e) => saveMeta({ awb: e.target.value })} className="field tnum" />
              </Field>
              <Field label="Internal note" hint="Only visible in this panel" className="sm:col-span-2">
                <textarea
                  rows={3}
                  defaultValue={open.notes}
                  onBlur={(e) => saveMeta({ notes: e.target.value })}
                  className="field resize-none"
                  placeholder="Gift wrap, called customer, courier delay…"
                />
              </Field>
            </div>

            {/* history */}
            <div>
              <p className="field-label">History</p>
              <ol className="space-y-2.5">
                {(open.timeline || []).map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-[0.82rem]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: META[t.status]?.colour }} />
                    <span>{META[t.status]?.label}</span>
                    <span className="ml-auto text-muted">
                      {dateLabel(t.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
