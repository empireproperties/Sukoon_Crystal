import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneCall, Search, ChevronLeft, ChevronRight, Video, Phone, Check, X,
  CalendarDays, Clock, Cake, MapPin, IndianRupee,
} from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { SlideOver, ConfirmDelete, Field, EmptyState, StatCard } from './ui.jsx';

const STATUS = {
  pending: { label: 'Awaiting confirmation', colour: '#c47a35' },
  confirmed: { label: 'Confirmed', colour: '#4b5296' },
  completed: { label: 'Completed', colour: '#4a8a5f' },
  no_show: { label: 'No show', colour: '#b4503c' },
  cancelled: { label: 'Cancelled', colour: '#8a8a8a' },
};

const iso = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const Badge = ({ status }) => {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className="badge shrink-0" style={{ color: s.colour, borderColor: `${s.colour}44`, background: `${s.colour}10` }}>
      {s.label}
    </span>
  );
};

export default function AdminBookings() {
  const { toast } = useShop();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);

  const { data: bookings = [], loading, reload } = useAsync(() => api.bookings({}), []);
  const today = iso(new Date());

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return (bookings || [])
      .filter((b) => filter === 'all' || b.status === filter)
      .filter((b) => !t || `${b.name} ${b.phone} ${b.concern} ${b.service}`.toLowerCase().includes(t))
      .sort((a, b) => b.date.localeCompare(a.date) || b.slot.localeCompare(a.slot));
  }, [bookings, filter, q]);

  const stats = useMemo(() => ({
    upcoming: (bookings || []).filter((b) => b.date >= today && !['cancelled', 'completed'].includes(b.status)).length,
    pending: (bookings || []).filter((b) => b.status === 'pending').length,
    completed: (bookings || []).filter((b) => b.status === 'completed').length,
    revenue: (bookings || []).filter((b) => b.status === 'completed').reduce((t, b) => t + (b.price || 0), 0),
  }), [bookings, today]);

  const month = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const first = base.getDay();
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const key = iso(new Date(base.getFullYear(), base.getMonth(), d));
      cells.push({
        day: d, key, today: key === today,
        items: (bookings || []).filter((b) => b.date === key && b.status !== 'cancelled'),
      });
    }
    return { label: base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), cells };
  }, [offset, bookings, today]);

  const update = async (id, patch) => {
    const updated = await api.updateBooking(id, patch);
    setOpen((o) => (o?.id === id ? updated : o));
    reload();
    toast('Consultation updated.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} icon={CalendarDays} label="Upcoming calls" value={stats.upcoming} />
        <StatCard index={1} icon={Clock} label="Awaiting confirmation" value={stats.pending} />
        <StatCard index={2} icon={Check} label="Completed" value={stats.completed} />
        <StatCard index={3} icon={IndianRupee} label="Consultation revenue" value={inr(stats.revenue)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ---------------------------------------------------- calendar */}
        <div className="h-fit border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="flex items-center justify-between">
            <button onClick={() => setOffset((o) => o - 1)} className="grid h-8 w-8 place-items-center rounded-[var(--r-btn)] text-muted hover:bg-bg2" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-[0.95rem] font-medium">{month.label}</h2>
            <button onClick={() => setOffset((o) => o + 1)} className="grid h-8 w-8 place-items-center rounded-[var(--r-btn)] text-muted hover:bg-bg2" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="pb-1.5 text-center text-[0.66rem] font-medium text-muted">{d}</span>
            ))}
            {month.cells.map((c, i) =>
              c === null ? <span key={`e${i}`} /> : (
                <button
                  key={c.key}
                  onClick={() => c.items.length && setOpen(c.items[0])}
                  disabled={!c.items.length}
                  className={`relative aspect-square rounded-[var(--r-btn)] border p-1 text-left transition-colors ${
                    c.items.length ? 'border-line bg-bg2 hover:border-brand' : 'border-transparent'
                  } ${c.today ? 'ring-1 ring-brand' : ''}`}
                >
                  <span className={`text-[0.74rem] ${c.items.length ? 'font-medium' : 'text-muted'}`}>{c.day}</span>
                  {c.items.length > 0 && (
                    <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-[0.6rem] text-onbrand">
                      {c.items.length}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <p className="mt-4 border-t border-line pt-3.5 text-[0.74rem] leading-relaxed text-muted">
            Numbered days have consultations booked. Click one to open it.
          </p>
        </div>

        {/* -------------------------------------------------------- list */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['all', ...Object.keys(STATUS)].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.78rem] transition-colors ${
                  filter === s ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:border-brand hover:text-ink'
                }`}
              >
                {s === 'all' ? 'All' : STATUS[s].label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or concern…" className="field !pl-9" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[72px]" style={{ borderRadius: 'var(--r-card)' }} />)}
            </div>
          ) : !list.length ? (
            <EmptyState icon={PhoneCall} title="No consultations" text="Nothing matches this filter." />
          ) : (
            <ul className="space-y-2">
              {list.slice(0, 40).map((b, i) => (
                <motion.li key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.3) }}>
                  <button
                    onClick={() => setOpen(b)}
                    className="flex w-full items-center gap-4 border border-line bg-surface p-4 text-left transition-colors hover:border-brand"
                    style={{ borderRadius: 'var(--r-card)' }}
                  >
                    <div className="shrink-0 border-r border-line pr-4 text-center">
                      <p className="text-lg font-semibold leading-none tnum">{new Date(b.date).getDate()}</p>
                      <p className="mt-1 text-[0.62rem] uppercase tracking-[0.1em] text-muted">
                        {dateLabel(b.date, { month: 'short' })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9rem] font-medium">{b.name}</p>
                      <p className="truncate text-[0.76rem] text-muted">{b.service} · {b.slot} · {b.concern}</p>
                    </div>
                    <Badge status={b.status} />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- detail */}
      <SlideOver
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        subtitle={open && `${dateLabel(open.date, { weekday: 'long', day: 'numeric', month: 'long' })} at ${open.slot}`}
        footer={
          open && (
            <div className="flex flex-wrap items-center gap-2">
              {open.status !== 'confirmed' && (
                <button onClick={() => update(open.id, { status: 'confirmed' })} className="btn btn-primary flex-1">
                  <Check size={14} /> Confirm booking
                </button>
              )}
              {open.status !== 'completed' && (
                <button onClick={() => update(open.id, { status: 'completed' })} className="btn btn-outline">Mark completed</button>
              )}
              <button onClick={() => update(open.id, { status: 'cancelled' })} className="btn btn-outline">
                <X size={13} /> Cancel
              </button>
              <ConfirmDelete
                onConfirm={async () => {
                  await api.deleteBooking(open.id);
                  setOpen(null);
                  reload();
                  toast('Booking removed.', 'success');
                }}
              />
            </div>
          )
        }
      >
        {open && (
          <div className="space-y-6">
            <div className="border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[1.05rem] font-medium">{open.service}</p>
                  <p className="mt-0.5 text-[0.78rem] text-muted">{open.minutes} minutes</p>
                </div>
                <span className="text-xl font-semibold tnum">{open.price ? inr(open.price) : 'Free'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-5 border-t border-line pt-4 text-[0.82rem] text-muted">
                <span className="flex items-center gap-2">
                  {open.mode === 'Video call' ? <Video size={13} strokeWidth={1.7} className="text-accent" /> : <Phone size={13} strokeWidth={1.7} className="text-accent" />}
                  {open.mode}
                </span>
                <span className="flex items-center gap-2"><Clock size={13} strokeWidth={1.7} className="text-accent" /> {open.slot} IST</span>
                <Badge status={open.status} />
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="field-label">Phone</dt>
                <dd className="text-[0.9rem]">{open.phone}</dd>
              </div>
              <div>
                <dt className="field-label">Email</dt>
                <dd className="break-all text-[0.9rem]">{open.email}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="field-label">Focus of the call</dt>
                <dd className="text-[0.9rem]">{open.concern}</dd>
              </div>
            </dl>

            <div className="border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <p className="field-label">Birth details</p>
              <div className="grid gap-3 text-[0.86rem] sm:grid-cols-3">
                <p className="flex items-center gap-2"><Cake size={13} strokeWidth={1.7} className="text-accent" /> {open.birthDate || '—'}</p>
                <p className="flex items-center gap-2"><Clock size={13} strokeWidth={1.7} className="text-accent" /> {open.birthTime || '—'}</p>
                <p className="flex items-center gap-2"><MapPin size={13} strokeWidth={1.7} className="text-accent" /> {open.birthPlace || '—'}</p>
              </div>
            </div>

            <Field label="Session notes" hint="Saved automatically when you click away">
              <textarea
                rows={5}
                defaultValue={open.notes}
                onBlur={(e) => update(open.id, { notes: e.target.value })}
                className="field resize-none"
                placeholder="What was discussed, what was recommended…"
              />
            </Field>

            <p className="text-[0.76rem] text-muted">
              Booked on {dateLabel(open.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
