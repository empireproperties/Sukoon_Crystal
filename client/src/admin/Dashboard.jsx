import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, IndianRupee, Package, Truck, CheckCircle2, Clock,
  PhoneCall, AlertTriangle, ChevronRight, Boxes,
} from 'lucide-react';

import { api, inr, compact, dateLabel } from '../lib/api.js';
import { useAsync } from '../lib/store.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { StatCard } from './ui.jsx';

const RANGES = [7, 30, 90];

const SERIES_COLOURS = ['#14392e', '#b0803a', '#4b5296', '#3d7fa3', '#c47a35', '#4a8a5f'];

const STATUS = {
  placed: { label: 'New', icon: Clock, colour: '#3d7fa3' },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, colour: '#4b5296' },
  packed: { label: 'Packed', icon: Package, colour: '#c47a35' },
  in_transit: { label: 'In transit', icon: Truck, colour: '#b0803a' },
  delivered: { label: 'Delivered', icon: CheckCircle2, colour: '#4a8a5f' },
  cancelled: { label: 'Cancelled', icon: AlertTriangle, colour: '#b4503c' },
};

function ChartTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-surface px-3.5 py-2.5 text-[0.78rem] shadow-[var(--shadow-pop)]" style={{ borderRadius: 'var(--r-card)' }}>
      <p className="mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted">{p.name}</span>
          <strong className="ml-auto tnum">{formatter ? formatter(p.value, p.dataKey) : p.value.toLocaleString('en-IN')}</strong>
        </p>
      ))}
    </div>
  );
}

const axis = { fontSize: 11, fill: 'var(--c-muted)' };

/* No visitor figures here: the in-house visit counts were wrong, so traffic
   is read from the Meta Pixel instead. Everything on this page comes from
   orders, bookings and stock, which the database records exactly. */
export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, loading } = useAsync(() => api.analytics(days), [days]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-32" style={{ borderRadius: 'var(--r-card)' }} />)}
      </div>
    );
  }

  const {
    kpis, series, fulfilment, topProducts,
    categoryRevenue, today, lowStock, recentOrders, upcomingBookings,
  } = data;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ today row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {[
            ['Orders today', today.orders],
            ['Revenue today', inr(today.revenue)],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[0.72rem] text-muted">{k}</p>
              <p className="mt-0.5 text-lg font-semibold tnum">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex rounded-[var(--r-btn)] border border-line bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-[calc(var(--r-btn)-1px)] px-3.5 py-1.5 text-[0.78rem] transition-colors ${
                days === r ? 'bg-brand text-onbrand' : 'text-muted hover:text-ink'
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <StatCard index={0} icon={IndianRupee} label="Revenue" value={inr(kpis.revenue.value)} delta={kpis.revenue.delta} hint={`Average order ${inr(kpis.aov.value)}`} />
        <StatCard index={1} icon={ShoppingCart} label="Orders" value={kpis.orders.value} delta={kpis.orders.delta} hint={`Last ${days} days`} />
        <StatCard index={2} icon={PhoneCall} label="Consultations booked" value={kpis.bookings.value} delta={kpis.bookings.delta} hint={`${upcomingBookings.length} upcoming`} />
      </div>

      {/* --------------------------------------------------- fulfilment row */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
        {Object.entries(STATUS).map(([key, meta], i) => (
          <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
            <Link
              to={`/admin/orders?status=${key}`}
              className="flex items-center gap-3 border border-line bg-surface p-3.5 transition-colors hover:border-brand"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-btn)]" style={{ background: `${meta.colour}15`, color: meta.colour }}>
                <meta.icon size={16} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-none tnum">{fulfilment[key]}</p>
                <p className="mt-1 truncate text-[0.72rem] text-muted">{meta.label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ---------------------------------------------------------- charts */}
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="border border-line bg-surface p-5 lg:col-span-2" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[0.98rem] font-medium">Revenue &amp; orders</h2>
              <p className="text-[0.74rem] text-muted">Last {days} days</p>
            </div>
            <span className="text-xl font-semibold tnum">{inr(kpis.revenue.value)}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ top: 5, right: 5, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14392e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#14392e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--c-line)" vertical={false} />
              <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(series.length / 7))} />
              <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
              <Tooltip content={<ChartTip formatter={(v, k) => (k === 'revenue' ? inr(v) : v)} />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#14392e" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="orders" name="Orders" stroke="#b0803a" strokeWidth={1.6} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
          <h2 className="text-[0.98rem] font-medium">Revenue by collection</h2>
          <p className="mb-3 text-[0.74rem] text-muted">Last {days} days</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryRevenue} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={112} tick={axis} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip formatter={(v) => inr(v)} />} cursor={{ fill: 'var(--c-bg2)' }} />
              <Bar dataKey="value" name="Revenue" radius={[0, 4, 4, 0]}>
                {categoryRevenue.map((_, i) => <Cell key={i} fill={SERIES_COLOURS[i % SERIES_COLOURS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* ------------------------------------------------------------ lists */}
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="border border-line bg-surface lg:col-span-2" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[0.98rem] font-medium">Latest orders</h2>
            <Link to="/admin/orders" className="text-[0.8rem] text-brand link-underline">View all</Link>
          </div>
          <ul className="divide-y divide-line">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link to="/admin/orders" className="table-row flex items-center gap-4 px-5 py-3">
                  <span className="w-16 shrink-0 text-[0.78rem] font-medium tnum">{o.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.85rem]">{o.customer.name}</p>
                    <p className="text-[0.72rem] text-muted">{o.customer.city} · {dateLabel(o.createdAt, { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <span
                    className="badge shrink-0"
                    style={{
                      color: STATUS[o.status]?.colour,
                      borderColor: `${STATUS[o.status]?.colour}44`,
                      background: `${STATUS[o.status]?.colour}10`,
                    }}
                  >
                    {STATUS[o.status]?.label}
                  </span>
                  <span className="w-20 shrink-0 text-right text-[0.85rem] font-medium tnum">{inr(o.total)}</span>
                  <ChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
            <h2 className="text-[0.98rem] font-medium">Best sellers</h2>
            <p className="mb-4 text-[0.74rem] text-muted">By revenue</p>
            <ul className="space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="w-3 shrink-0 text-[0.8rem] text-muted tnum">{i + 1}</span>
                  <ProductImage product={{ name: p.name, image: p.image }} className="h-10 w-10 shrink-0" imgClassName="rounded-[var(--r-btn)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8rem]">{p.name}</p>
                    <p className="text-[0.7rem] text-muted">{p.units} sold</p>
                  </div>
                  <span className="shrink-0 text-[0.8rem] font-medium tnum">{inr(p.revenue)}</span>
                </li>
              ))}
              {!topProducts.length && <li className="text-[0.8rem] text-muted">No sales in this period.</li>}
            </ul>
          </section>

          <section className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[0.98rem] font-medium">Next consultations</h2>
              <Link to="/admin/bookings" className="text-[0.8rem] text-brand link-underline">All</Link>
            </div>
            <ul className="divide-y divide-line">
              {upcomingBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-btn)] bg-brand-soft text-[0.7rem] font-medium text-brand">
                    {b.slot.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem]">{b.name}</p>
                    <p className="truncate text-[0.7rem] text-muted">{b.service} · {dateLabel(b.date, { day: 'numeric', month: 'short' })}</p>
                  </div>
                </li>
              ))}
              {!upcomingBookings.length && <li className="px-5 py-4 text-[0.8rem] text-muted">Nothing booked yet.</li>}
            </ul>
          </section>

          <section className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <Boxes size={16} strokeWidth={1.7} className="text-accent" />
              <h2 className="text-[0.98rem] font-medium">Running low</h2>
            </div>
            <ul className="divide-y divide-line">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8rem]">
                  <span className="truncate text-muted">{p.name}</span>
                  <span className={`ml-auto shrink-0 badge ${p.stock <= 3 ? 'badge-sale' : 'badge-neutral'}`}>
                    {p.stock} left
                  </span>
                </li>
              ))}
              {!lowStock.length && <li className="px-5 py-4 text-[0.8rem] text-muted">Everything is well stocked.</li>}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <Link to="/admin/products" className="text-[0.8rem] text-brand link-underline">Restock in products</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
