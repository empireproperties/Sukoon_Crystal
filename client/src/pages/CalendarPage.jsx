import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Clock, ArrowRight, Bell, X } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { SectionHead } from './home/shared.jsx';


const TYPE = {
  celestial: { label: 'Celestial', colour: '#4b5296' },
  festival: { label: 'Festival', colour: '#c47a35' },
  live: { label: 'Live session', colour: '#4a8a5f' },
  workshop: { label: 'Workshop', colour: '#3d7fa3' },
};

const iso = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function CalendarPage() {
  const { toast } = useShop();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: events = [], loading } = useAsync(() => api.events(), []);
  const list = useMemo(
    () => (events || []).filter((e) => filter === 'all' || e.type === filter),
    [events, filter]
  );

  const today = iso(new Date());

  const month = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const first = base.getDay();
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const key = iso(new Date(base.getFullYear(), base.getMonth(), d));
      cells.push({ day: d, key, today: key === today, events: list.filter((e) => e.date === key) });
    }
    return { label: base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), cells };
  }, [offset, list, today]);

  const upcoming = useMemo(() => list.filter((e) => e.date >= today).slice(0, 8), [list, today]);

  return (
    <>
      <div className="border-b border-line bg-bg2">
        <div className="wrap py-10">
          <p className="eyebrow">Celestial calendar</p>
          <h1 className="mt-2.5 text-3xl sm:text-4xl">What the sky is doing next</h1>
          <p className="mt-2.5 max-w-xl text-[0.94rem] leading-relaxed text-muted">
            Full moons for charging, retrogrades to plan around, festivals worth marking, and the free
            live sessions Swati runs each month.
          </p>
        </div>
      </div>

      <div className="wrap py-9">
        <div className="mb-7 flex flex-wrap gap-2">
          {['all', ...Object.keys(TYPE)].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-[var(--r-btn)] border px-3.5 py-2 text-[0.8rem] transition-colors ${
                filter === t ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
              }`}
            >
              {t === 'all' ? 'Everything' : TYPE[t].label}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {/* ------------------------------------------------------ calendar */}
          <div className="border border-line bg-surface p-5 sm:p-6" style={{ borderRadius: 'var(--r-card)' }}>
            <div className="flex items-center justify-between">
              <button onClick={() => setOffset((o) => o - 1)} className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)] text-muted transition-colors hover:bg-bg2" aria-label="Previous month">
                <ChevronLeft size={17} />
              </button>
              <h2 className="text-lg font-medium">{month.label}</h2>
              <button onClick={() => setOffset((o) => o + 1)} className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)] text-muted transition-colors hover:bg-bg2" aria-label="Next month">
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d} className="pb-2 text-center text-[0.68rem] font-medium text-muted">{d.slice(0, 1)}</span>
              ))}
              {month.cells.map((c, i) =>
                c === null ? <span key={`e${i}`} /> : (
                  <button
                    key={c.key}
                    onClick={() => c.events.length && setSelected(c.events[0])}
                    disabled={!c.events.length}
                    className={`relative aspect-square rounded-[var(--r-btn)] border p-1.5 text-left transition-colors ${
                      c.events.length ? 'border-line bg-bg2 hover:border-brand' : 'border-transparent'
                    } ${c.today ? 'ring-1 ring-brand' : ''}`}
                  >
                    <span className={`text-[0.78rem] ${c.events.length ? 'font-medium' : 'text-muted'}`}>{c.day}</span>
                    {c.events.length > 0 && (
                      <span className="absolute bottom-1.5 left-1.5 flex gap-0.5">
                        {c.events.slice(0, 3).map((e, k) => (
                          <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE[e.type]?.colour || 'var(--c-accent)' }} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-4">
              {Object.entries(TYPE).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-[0.74rem] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.colour }} /> {v.label}
                </span>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------ upcoming */}
          <div>
            <h2 className="text-lg font-medium">Coming up</h2>
            <ul className="mt-4 space-y-2.5">
              {loading
                ? Array.from({ length: 5 }, (_, i) => <li key={i} className="skeleton h-20" style={{ borderRadius: 'var(--r-card)' }} />)
                : upcoming.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelected(e)}
                        className="flex w-full gap-4 border border-line bg-surface p-4 text-left transition-colors hover:border-brand"
                        style={{ borderRadius: 'var(--r-card)' }}
                      >
                        <div className="shrink-0 border-r border-line pr-4 text-center">
                          <p className="text-xl font-semibold leading-none">{new Date(e.date).getDate()}</p>
                          <p className="mt-1 text-[0.62rem] uppercase tracking-[0.1em] text-muted">
                            {dateLabel(e.date, { month: 'short' })}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <span
                            className="badge"
                            style={{
                              color: TYPE[e.type]?.colour,
                              borderColor: `${TYPE[e.type]?.colour}55`,
                              background: `${TYPE[e.type]?.colour}12`,
                            }}
                          >
                            {TYPE[e.type]?.label}
                          </span>
                          <h3 className="mt-1.5 line-clamp-2 text-[0.9rem] font-medium leading-snug">{e.title}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-muted">
                            <Clock size={11} strokeWidth={1.8} /> {e.time}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
              {!loading && !upcoming.length && (
                <li className="border border-line bg-surface p-6 text-center text-[0.86rem] text-muted" style={{ borderRadius: 'var(--r-card)' }}>
                  Nothing scheduled in this category yet.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* ------------------------------------------------------- detail */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center p-5">
              <div className="absolute inset-0 bg-ink/40" onClick={() => setSelected(null)} />
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.97, y: 8 }}
                transition={{ duration: 0.22 }}
                className="relative w-full max-w-lg border border-line bg-surface p-7 shadow-2xl"
                style={{ borderRadius: 'var(--r-card)' }}
                role="dialog"
              >
                <button onClick={() => setSelected(null)} className="absolute right-4 top-4 rounded-[var(--r-btn)] p-1.5 text-muted hover:bg-bg2" aria-label="Close">
                  <X size={17} />
                </button>
                <span
                  className="badge"
                  style={{
                    color: TYPE[selected.type]?.colour,
                    borderColor: `${TYPE[selected.type]?.colour}55`,
                    background: `${TYPE[selected.type]?.colour}12`,
                  }}
                >
                  {TYPE[selected.type]?.label}
                </span>
                <h3 className="mt-3 pr-8 text-2xl leading-snug">{selected.title}</h3>
                <p className="mt-3 text-[0.9rem] leading-relaxed text-muted">{selected.description}</p>
                <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-[0.86rem]">
                  <div className="flex gap-3">
                    <dt><Clock size={14} strokeWidth={1.7} className="text-accent" /></dt>
                    <dd className="text-muted">
                      {dateLabel(selected.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {selected.time}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt><MapPin size={14} strokeWidth={1.7} className="text-accent" /></dt>
                    <dd className="text-muted">{selected.location}</dd>
                  </div>
                </dl>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => { toast('We will remind you the day before.', 'success'); setSelected(null); }}
                    className="btn btn-primary flex-1"
                  >
                    <Bell size={14} strokeWidth={1.8} /> Remind me
                  </button>
                  <button onClick={() => setSelected(null)} className="btn btn-outline">Close</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-14 border-t border-line pt-12 text-center">
          <SectionHead
            eyebrow="Want it personal?"
            title="Your own chart, read aloud"
            sub="The calendar tells you what the sky is doing. A reading tells you what it means for you."
            align="center"
          />
          <Link to="/book" className="btn btn-primary btn-lg mt-7">
            Book a consultation <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </>
  );
}
