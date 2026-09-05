import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Mail, Phone, MapPin, ShoppingCart, UserCheck, Download,
  Sparkles, X, Loader2,
} from 'lucide-react';

import { api, inr, dateLabel, compact } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { EmptyState, StatCard } from './ui.jsx';
import Kundli from '../components/Kundli.jsx';

/* Turns rows into a CSV the owner can open in Excel. Quotes are doubled and
   every field is wrapped, so a comma in an address cannot shift the columns. */
function toCsv(rows) {
  const cols = ['name', 'email', 'phone', 'city', 'orders', 'spent', 'hasAccount', 'lastOrderAt'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

/* Swati reads the chart before the call, so the customer does not spend the
   first ten minutes repeating their birth details. No shop, no upsell — this
   is a working document. */
function ChartDialog({ customer, onClose }) {
  const [state, setState] = useState({ loading: true, chart: null, error: '' });

  useEffect(() => {
    let dead = false;
    api.customerChart(customer.id)
      .then((d) => { if (!dead) setState({ loading: false, chart: d.chart, error: '' }); })
      .catch((e) => { if (!dead) setState({ loading: false, chart: null, error: e.message }); });
    return () => { dead = true; };
  }, [customer.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-ink/55 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-5xl bg-surface p-5 shadow-[var(--shadow-pop)] sm:p-8"
        style={{ borderRadius: 'var(--r-card)' }}
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-[1.15rem]">{customer.name || 'Customer'}</h2>
            <p className="mt-0.5 text-[0.8rem] text-muted">
              {customer.email}
              {customer.birth && ` · born ${customer.birth.date}${customer.birth.time ? ` at ${customer.birth.time}` : ' (time unknown)'}, ${customer.birth.place}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-2 text-muted hover:bg-bg2 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {state.loading ? (
          <p className="flex items-center gap-2 py-16 text-[0.9rem] text-muted">
            <Loader2 size={15} className="animate-spin" /> Loading the chart…
          </p>
        ) : state.error ? (
          <p className="py-16 text-center text-[0.9rem] text-sale">{state.error}</p>
        ) : !state.chart ? (
          <p className="py-16 text-center text-[0.9rem] text-muted">
            This customer has not drawn a chart yet.
          </p>
        ) : (
          <Kundli chart={state.chart} forSale={false} />
        )}
      </div>
    </div>
  );
}

export default function AdminCustomers() {
  const { toast } = useShop();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    api.customersSummary().then(setRows).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((c) => [c.name, c.email, c.phone, c.city].filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [rows, q]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const withAccount = rows.filter((c) => c.hasAccount).length;
    const spent = rows.reduce((s, c) => s + c.spent, 0);
    const repeat = rows.filter((c) => c.orders > 1).length;
    return { total: rows.length, withAccount, spent, repeat };
  }, [rows]);

  const download = () => {
    const blob = new Blob([toCsv(filtered || [])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sukoon-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!rows) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-bg2" />)}</div>;
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Customers" value={compact(stats.total)} index={0} />
        <StatCard icon={UserCheck} label="With an account" value={compact(stats.withAccount)} hint="Rest are guest checkouts" index={1} />
        <StatCard icon={ShoppingCart} label="Repeat buyers" value={compact(stats.repeat)} index={2} />
        <StatCard icon={ShoppingCart} label="Lifetime value" value={inr(stats.spent)} index={3} />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !pl-10" placeholder="Search name, email, phone or city"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={download} className="btn border border-line" disabled={!filtered?.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {!filtered.length ? (
        <div className="mt-6">
          <EmptyState icon={Users} title="No customers yet"
            text="Everyone who orders — with or without an account — appears here." />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto border border-line" style={{ borderRadius: 'var(--r-card)' }}>
          <table className="w-full min-w-[720px] border-collapse text-[0.86rem]">
            <thead>
              <tr className="border-b border-line bg-bg2 text-left">
                {['Customer', 'Contact', 'Location', 'Birth chart', 'Orders', 'Spent', 'Last order'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[0.72rem] uppercase tracking-[0.12em] text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr key={c.id + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 12) * 0.015 }}
                  className="border-b border-line last:border-0 hover:bg-bg2/60">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name || '—'}</p>
                    {c.hasAccount ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] text-brand">
                        <UserCheck size={10} /> Has an account
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-block text-[0.7rem] text-muted">Guest checkout</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5 text-[0.8rem] text-muted">
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-brand"><Mail size={11} /> {c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-brand"><Phone size={11} /> {c.phone}</a>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.city ? <span className="flex items-center gap-1.5"><MapPin size={11} /> {c.city}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.hasChart ? (
                      <button
                        onClick={() => setViewing(c)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[0.72rem] text-brand transition-colors hover:bg-brand hover:text-onbrand"
                      >
                        <Sparkles size={11} strokeWidth={2} /> View
                      </button>
                    ) : (
                      <span className="text-[0.76rem] text-muted">—</span>
                    )}
                    {c.birth && (
                      <span className="mt-1 block text-[0.7rem] text-muted">{c.birth.date}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.orders}</td>
                  <td className="px-4 py-3 font-medium">{inr(c.spent)}</td>
                  <td className="px-4 py-3 text-muted">{c.lastOrderAt ? dateLabel(c.lastOrderAt) : '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && <ChartDialog customer={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
