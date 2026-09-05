import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, MapPin, Clock } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { SlideOver, ConfirmDelete, Toggle, Field, EmptyState, StatCard } from './ui.jsx';

const TYPES = [
  { id: 'celestial', label: 'Celestial', colour: '#4b5296' },
  { id: 'festival', label: 'Festival', colour: '#c47a35' },
  { id: 'live', label: 'Live session', colour: '#4a8a5f' },
  { id: 'workshop', label: 'Workshop', colour: '#3d7fa3' },
];

const iso = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const blank = () => ({
  title: '', date: iso(new Date()), time: '19:00', type: 'celestial',
  description: '', location: 'Online / Instagram Live', published: true,
});

const PRESETS = [
  { title: 'Full Moon Charging Ritual', type: 'celestial', time: '20:30', description: 'The best night of the month to cleanse every crystal you own. Step-by-step ritual shared live at moonrise.' },
  { title: 'Live Q&A with Swati', type: 'live', time: '18:30', description: 'Bring your birth chart questions. Forty-five minutes, unfiltered, on Instagram Live.' },
  { title: 'Navratri Nine-Night Series', type: 'festival', time: '19:00', description: 'Nine nights, nine goddesses, nine stones — a short ritual each evening with a companion crystal.' },
  { title: 'Numerology Masterclass', type: 'workshop', time: '17:00', description: 'A ninety-minute live workshop decoding your life path number and the crystals that support it.' },
];

export default function AdminEvents() {
  const { toast } = useShop();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: events = [], loading, reload } = useAsync(() => api.events(true), []);
  const today = iso(new Date());

  const stats = useMemo(() => ({
    total: (events || []).length,
    upcoming: (events || []).filter((e) => e.date >= today).length,
    published: (events || []).filter((e) => e.published !== false).length,
    drafts: (events || []).filter((e) => e.published === false).length,
  }), [events, today]);

  const month = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const first = base.getDay();
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const key = iso(new Date(base.getFullYear(), base.getMonth(), d));
      cells.push({ day: d, key, today: key === today, items: (events || []).filter((e) => e.date === key) });
    }
    return { label: base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), cells };
  }, [offset, events, today]);

  const patch = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  const save = async () => {
    if (!editing.title?.trim()) return toast('Give the event a title.', 'warn');
    setSaving(true);
    try {
      if (editing.id) await api.updateEvent(editing.id, editing);
      else await api.createEvent(editing);
      toast(editing.id ? 'Event updated.' : 'Event added to the calendar.', 'success');
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (e) => {
    await api.updateEvent(e.id, { published: e.published === false });
    reload();
  };

  const sorted = useMemo(
    () => [...(events || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} icon={CalendarDays} label="Events in total" value={stats.total} />
        <StatCard index={1} icon={Clock} label="Still to come" value={stats.upcoming} />
        <StatCard index={2} icon={Eye} label="Published" value={stats.published} />
        <StatCard index={3} icon={EyeOff} label="Drafts" value={stats.drafts} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-[0.86rem] leading-relaxed text-muted">
          Everything here appears on the public celestial calendar and on the home page. Drafts stay hidden.
        </p>
        <button onClick={() => setEditing(blank())} className="btn btn-primary btn-sm">
          <Plus size={14} /> New event
        </button>
      </div>

      <div>
        <p className="field-label">Quick add from a template</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.title}
              onClick={() => setEditing({ ...blank(), ...p })}
              className="flex items-center gap-2 rounded-[var(--r-btn)] border border-line bg-surface px-3.5 py-2 text-[0.8rem] transition-colors hover:border-brand hover:text-brand"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: typeOf(p.type).colour }} />
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* calendar */}
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
                  onClick={() => (c.items.length ? setEditing({ ...c.items[0] }) : setEditing({ ...blank(), date: c.key }))}
                  className={`relative aspect-square rounded-[var(--r-btn)] border p-1 text-left transition-colors ${
                    c.items.length ? 'border-line bg-bg2 hover:border-brand' : 'border-transparent hover:bg-bg2'
                  } ${c.today ? 'ring-1 ring-brand' : ''}`}
                >
                  <span className="text-[0.72rem]">{c.day}</span>
                  {c.items.length > 0 && (
                    <span className="absolute bottom-1 left-1 flex gap-0.5">
                      {c.items.slice(0, 3).map((e, k) => (
                        <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: typeOf(e.type).colour }} />
                      ))}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
            {TYPES.map((t) => (
              <span key={t.id} className="flex items-center gap-1.5 text-[0.72rem] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: t.colour }} /> {t.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[0.74rem] text-muted">Click any empty day to add an event on that date.</p>
        </div>

        {/* list */}
        <div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-20" style={{ borderRadius: 'var(--r-card)' }} />)}</div>
          ) : !sorted.length ? (
            <EmptyState icon={CalendarDays} title="No events yet" text="Add a full moon, a festival or a live session." action={<button onClick={() => setEditing(blank())} className="btn btn-primary">New event</button>} />
          ) : (
            <ul className="space-y-2">
              {sorted.map((e, i) => {
                const t = typeOf(e.type);
                const past = e.date < today;
                return (
                  <motion.li key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                    <div
                      className={`flex items-center gap-4 border border-line bg-surface p-4 transition-colors hover:border-brand ${past ? 'opacity-60' : ''}`}
                      style={{ borderRadius: 'var(--r-card)' }}
                    >
                      <button onClick={() => setEditing({ ...e })} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                        <div className="shrink-0 border-r border-line pr-4 text-center">
                          <p className="text-lg font-semibold leading-none">{new Date(e.date).getDate()}</p>
                          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.1em] text-muted">
                            {dateLabel(e.date, { month: 'short' })}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge" style={{ color: t.colour, borderColor: `${t.colour}55`, background: `${t.colour}12` }}>
                              {t.label}
                            </span>
                            {e.published === false && <span className="badge badge-neutral">Draft</span>}
                          </div>
                          <p className="mt-1.5 line-clamp-1 text-[0.9rem] font-medium">{e.title}</p>
                          <p className="mt-0.5 flex items-center gap-3 text-[0.74rem] text-muted">
                            <span className="flex items-center gap-1"><Clock size={10} /> {e.time}</span>
                            <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {e.location}</span>
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => togglePublished(e)}
                        className={`shrink-0 rounded-[var(--r-btn)] p-2 transition-colors ${
                          e.published === false ? 'text-muted hover:bg-bg2' : 'text-brand hover:bg-brand-soft'
                        }`}
                        title={e.published === false ? 'Publish' : 'Unpublish'}
                      >
                        {e.published === false ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* editor */}
      <SlideOver
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit event' : 'New event'}
        subtitle="Appears on the public celestial calendar"
        footer={
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add to calendar'}
            </button>
            {editing?.id && (
              <ConfirmDelete onConfirm={async () => { await api.deleteEvent(editing.id); setEditing(null); reload(); toast('Event deleted.', 'success'); }} />
            )}
          </div>
        }
      >
        {editing && (
          <div className="space-y-5">
            <Field label="Event title">
              <input value={editing.title} onChange={(e) => patch('title', e.target.value)} className="field" placeholder="Full Moon Charging Ritual" />
            </Field>

            <Field label="Type">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => patch('type', t.id)}
                    className={`flex items-center gap-2 rounded-[var(--r-btn)] border px-3.5 py-2 text-[0.82rem] transition-colors ${
                      editing.type === t.id ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: t.colour }} /> {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input type="date" value={editing.date} onChange={(e) => patch('date', e.target.value)} className="field" />
              </Field>
              <Field label="Time">
                <input type="time" value={editing.time} onChange={(e) => patch('time', e.target.value)} className="field" />
              </Field>
            </div>

            <Field label="Where is it?" hint="Shown under the event on the calendar page">
              <input value={editing.location} onChange={(e) => patch('location', e.target.value)} className="field" placeholder="Online / Instagram Live" />
            </Field>

            <Field label="Description">
              <textarea rows={5} value={editing.description} onChange={(e) => patch('description', e.target.value)} className="field resize-none" placeholder="What happens, who it is for, what to bring…" />
            </Field>

            <div className="border border-line bg-bg2 p-4" style={{ borderRadius: 'var(--r-card)' }}>
              <Toggle
                checked={editing.published !== false}
                onChange={(v) => patch('published', v)}
                label="Published on the website"
                hint="Turn off to keep it as a draft"
              />
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
