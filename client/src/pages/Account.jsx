import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Package, RotateCcw, LogOut, Mail, Phone, ArrowRight, ChevronRight, X, Check,
  Sparkles, Loader2,
} from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useAccount } from '../lib/account.jsx';
import { useShop } from '../lib/store.jsx';
import AccountAuth from './AccountAuth.jsx';
import AddressFields from '../components/AddressFields.jsx';
import ReturnDialog from '../components/ReturnDialog.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import Kundli from '../components/Kundli.jsx';

const STATUS_TONE = {
  placed: 'text-muted', confirmed: 'text-muted', packed: 'text-accent',
  in_transit: 'text-accent', delivered: 'text-brand', cancelled: 'text-sale',
  requested: 'text-accent', approved: 'text-brand', rejected: 'text-sale',
  picked_up: 'text-accent', refunded: 'text-brand', replaced: 'text-brand', closed: 'text-muted',
};

const pretty = (s = '') => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/* ---------------------------------------------------------------- profile */

/* Deliberately short: name, phone, one address. Nothing else is needed to ship
   an order, and every extra field is one more reason to abandon the form.
   Whatever is saved here fills the checkout, so it is only ever typed once. */
function Profile({ user, save }) {
  const { toast } = useShop();
  const a = user.addresses?.[0] || {};
  const [f, setF] = useState({
    name: user.name || '',
    phone: user.phone || '',
    address: a.address || a.line || '',
    city: a.city || '',
    state: a.state || '',
    pincode: a.pincode || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const complete = f.name && f.phone && f.address && f.city && f.pincode;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        name: f.name,
        phone: f.phone,
        /* One address, stored as the first entry so checkout can read it. */
        addresses: [{
          label: 'Home',
          address: f.address, city: f.city, state: f.state, pincode: f.pincode,
        }],
      });
      toast('Saved. Checkout will use these details.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg">
      <div className={`mb-5 flex items-start gap-2.5 border p-3.5 ${complete ? 'border-ok/30 bg-ok/5' : 'border-accent/30 bg-accent/5'}`}
           style={{ borderRadius: 'var(--r-btn)' }}>
        <Check size={14} strokeWidth={2.2} className={`mt-0.5 shrink-0 ${complete ? 'text-ok' : 'text-accent'}`} />
        <p className="text-[0.82rem] leading-relaxed text-muted">
          {complete
            ? 'Your checkout is prefilled — you will not be asked for these again.'
            : 'Fill these once and checkout stops asking for them every time.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="pf-name">Name</label>
          <input id="pf-name" className="field" value={f.name} onChange={set('name')} autoComplete="name" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="pf-phone">Phone</label>
          <input id="pf-phone" className="field" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91 90000 00000" />
        </div>
        <AddressFields
          idPrefix="pf"
          value={f}
          onChange={(next) => setF((v) => ({ ...v, ...next }))}
        />
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
        <span className="flex items-center gap-1.5 text-[0.8rem] text-muted">
          <Mail size={13} /> {user.email}
        </span>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- orders */
function Orders({ onReturn }) {
  const [orders, setOrders] = useState(null);
  const [eligibility, setEligibility] = useState({});

  const load = async () => {
    const list = await api.myOrders().catch(() => []);
    setOrders(list);
    /* Ask the server which orders are actually returnable rather than
       re-implementing the window rule in the browser. */
    const checks = await Promise.all(
      list.filter((o) => o.status === 'delivered')
        .map((o) => api.returnable(o.id).then((r) => [o.id, r]).catch(() => [o.id, { ok: false }]))
    );
    setEligibility(Object.fromEntries(checks));
  };

  useEffect(() => { load(); }, []);

  if (!orders) return <div className="h-24 animate-pulse rounded bg-bg2" />;
  if (!orders.length) {
    return (
      <div className="border border-line bg-bg2 p-8 text-center" style={{ borderRadius: 'var(--r-card)' }}>
        <Package size={26} className="mx-auto text-muted" strokeWidth={1.5} />
        <p className="mt-3 text-[0.92rem] font-medium">No orders yet</p>
        <p className="mt-1 text-[0.84rem] text-muted">When you place one, it will appear here.</p>
        <Link to="/shop" className="btn btn-primary mt-5">Start shopping <ArrowRight size={14} /></Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const el = eligibility[o.id];
        return (
          <div key={o.id} className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.9rem] font-medium">{o.number}</p>
                <p className="mt-0.5 text-[0.78rem] text-muted">{dateLabel(o.createdAt)} · {o.items?.length || 0} item(s)</p>
              </div>
              <div className="text-right">
                <p className="text-[0.95rem] font-medium">{inr(o.total)}</p>
                <p className={`mt-0.5 text-[0.76rem] ${STATUS_TONE[o.status] || 'text-muted'}`}>{pretty(o.status)}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
              {(o.items || []).slice(0, 3).map((it, i) => (
                <li key={i} className="flex justify-between gap-3 text-[0.82rem] text-muted">
                  <span className="truncate">{it.name} × {it.qty}</span>
                  <span className="shrink-0">{inr((it.price || 0) * (it.qty || 1))}</span>
                </li>
              ))}
              {(o.items?.length || 0) > 3 && <li className="text-[0.78rem] text-muted">+{o.items.length - 3} more</li>}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/track?number=${encodeURIComponent(o.number)}`} className="btn border border-line">
                Track <ChevronRight size={13} />
              </Link>
              {el?.ok && (
                <button onClick={() => onReturn(o)} className="btn border border-line">
                  <RotateCcw size={13} /> Return · {el.daysLeft} day(s) left
                </button>
              )}
              {o.status === 'delivered' && el && !el.ok && (
                <span className="self-center text-[0.76rem] text-muted">{el.reason}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- returns */
function Returns({ version }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.myReturns().then(setList).catch(() => setList([])); }, [version]);

  if (!list) return <div className="h-24 animate-pulse rounded bg-bg2" />;
  if (!list.length) {
    return (
      <div className="border border-line bg-bg2 p-8 text-center" style={{ borderRadius: 'var(--r-card)' }}>
        <RotateCcw size={26} className="mx-auto text-muted" strokeWidth={1.5} />
        <p className="mt-3 text-[0.92rem] font-medium">No returns</p>
        <p className="mt-1 text-[0.84rem] text-muted">
          You can raise one from any delivered order within 7 days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <div key={r.id} className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.9rem] font-medium">{r.number}</p>
              <p className="mt-0.5 text-[0.78rem] text-muted">Order {r.orderNumber} · {dateLabel(r.createdAt)}</p>
            </div>
            <span className={`text-[0.78rem] ${STATUS_TONE[r.status] || 'text-muted'}`}>{pretty(r.status)}</span>
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[0.85rem]">{r.reason}</p>
          {r.details && <p className="mt-1.5 text-[0.82rem] text-muted">{r.details}</p>}
          {r.resolution && (
            <p className="mt-3 border-l-2 border-accent pl-3 text-[0.82rem] text-muted">{r.resolution}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- birth chart */
/* The chart lives on the profile alongside the address and the order history,
   which is the whole point of it — one place that holds everything we know
   about someone. Drawing and redrawing happens on its own page, where there is
   room to explain what the reading means. */
function BirthChartTab() {
  const [state, setState] = useState({ loading: true, chart: null });

  useEffect(() => {
    let dead = false;
    api.myChart()
      .then((d) => { if (!dead) setState({ loading: false, chart: d.chart }); })
      .catch(() => { if (!dead) setState({ loading: false, chart: null }); });
    return () => { dead = true; };
  }, []);

  if (state.loading) {
    return (
      <p className="flex items-center gap-2 py-14 text-[0.88rem] text-muted">
        <Loader2 size={15} className="animate-spin" /> Loading your chart…
      </p>
    );
  }

  if (!state.chart) {
    return (
      <div className="border border-brand/25 bg-brand-soft p-6 text-center sm:p-10" style={{ borderRadius: 'var(--r-card)' }}>
        <Sparkles size={22} strokeWidth={1.5} className="mx-auto text-brand" />
        <h2 className="mt-3 font-display text-[1.5rem] leading-tight">Your birth chart, free</h2>
        <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-muted">
          Give us your date, time and place of birth and we will draw your Vedic kundli, read it
          back to you plainly, and tell you which stones your chart is asking for.
        </p>
        <Link to="/birth-chart" className="btn btn-primary btn-lg mt-5">
          <Sparkles size={15} strokeWidth={1.8} /> Draw my chart
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.86rem] text-muted">Saved to your profile.</p>
        <Link to="/birth-chart" className="btn btn-sm border border-line">
          Open full reading <ArrowRight size={13} />
        </Link>
      </div>
      <Kundli chart={state.chart} />
    </div>
  );
}

/* ------------------------------------------------------------------- page */
const TABS = [
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'chart', label: 'Birth chart', icon: Sparkles },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function Account() {
  const { user, loading, signOut, save } = useAccount();
  const [tab, setTab] = useState('orders');
  const [returning, setReturning] = useState(null);
  const [version, setVersion] = useState(0);

  if (loading) {
    return <div className="wrap py-20"><div className="h-40 animate-pulse rounded bg-bg2" /></div>;
  }
  if (!user) return <AccountAuth />;

  return (
    <div className="wrap py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">My account</p>
          <h1 className="mt-2 font-[var(--font-display)] text-[clamp(1.7rem,4.5vw,2.6rem)] leading-tight">
            Namaste, {user.name?.split(' ')[0] || 'friend'}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[0.84rem] text-muted">
            <Mail size={13} /> {user.email}
            {user.phone && <><span className="opacity-40">·</span><Phone size={13} /> {user.phone}</>}
          </p>
        </div>
        <button onClick={signOut} className="btn border border-line"><LogOut size={14} /> Sign out</button>
      </div>

      <div className="no-scrollbar mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[0.86rem] transition ${
              tab === id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Icon size={15} strokeWidth={1.7} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {tab === 'orders' && <Orders onReturn={setReturning} />}
        {tab === 'returns' && <Returns version={version} />}
        {tab === 'chart' && <BirthChartTab />}
        {tab === 'profile' && <Profile user={user} save={save} />}
      </div>

      {returning && (
        <ReturnDialog
          order={returning}
          onClose={() => setReturning(null)}
          onDone={() => { setVersion((v) => v + 1); setTab('returns'); }}
        />
      )}
    </div>
  );
}
