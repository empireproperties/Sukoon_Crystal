import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ChevronLeft, ChevronRight, Clock, Video, Phone, CalendarCheck, ArrowRight, ShieldCheck, BadgeCheck, Sparkles,
} from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { CountUp } from '../components/Motion.jsx';


const CONCERNS = [
  'Career & business direction', 'Marriage & relationship', 'Health & wellbeing',
  'Financial blocks', 'Which crystal suits me', 'Custom bracelet consultation',
  'Numerology reading', 'Home & vastu energy',
];

const STEPS = ['Service', 'Date & time', 'Your details', 'Confirm'];

const iso = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function Book() {
  const { toast } = useShop();
  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', concern: CONCERNS[0],
    birthDate: '', birthTime: '', birthPlace: '', mode: 'Video call', notes: '',
  });

  const services = useAsync(() => api.services(), []);
  const availability = useAsync(() => (date ? api.availability(date) : Promise.resolve(null)), [date]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const calendar = useMemo(() => {
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const first = base.getDay();
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const dt = new Date(base.getFullYear(), base.getMonth(), d);
      const key = iso(dt);
      cells.push({
        day: d, key,
        past: key < iso(today),
        today: key === iso(today),
        far: (dt - today) / 86400000 > 45,
      });
    }
    return { label: base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), cells };
  }, [monthOffset]);

  const submit = async () => {
    setSaving(true);
    try {
      setConfirmed(await api.book({ ...form, serviceId: service.id, date, slot }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const canAdvance =
    (step === 0 && service) ||
    (step === 1 && date && slot) ||
    (step === 2 && form.name && form.phone && form.email);

  /* ------------------------------------------------------------ confirmed */
  if (confirmed) {
    return (
      <div className="wrap py-14">
        <div className="mx-auto max-w-xl text-center">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/10 text-ok">
            <CalendarCheck size={28} strokeWidth={2} />
          </motion.div>
          <h1 className="mt-6 text-3xl">Your consultation is booked</h1>
          <p className="mx-auto mt-3 max-w-md text-[0.92rem] leading-relaxed text-muted">
            Swati will call you on <strong className="text-ink">{confirmed.phone}</strong> at the time below.
            Keep your birth details handy, and a quiet room if you can.
          </p>

          <dl className="mt-8 divide-y divide-line border border-line bg-surface text-left" style={{ borderRadius: 'var(--r-card)' }}>
            {[
              ['Service', confirmed.service],
              ['Date', dateLabel(confirmed.date, { weekday: 'long', day: 'numeric', month: 'long' })],
              ['Time', `${confirmed.slot} IST · ${confirmed.minutes} minutes`],
              ['Mode', confirmed.mode],
              ['Fee', confirmed.price ? inr(confirmed.price) : 'Complimentary'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-[0.82rem] text-muted">{k}</dt>
                <dd className="text-right text-[0.88rem]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/shop" className="btn btn-primary">Browse the collection <ArrowRight size={14} /></Link>
            <Link to="/calendar" className="btn btn-outline">See what's coming up</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------------- flow */
  return (
    <>
      {/* Placed above the booking form on purpose. Someone who arrives here
          unsure is far more likely to book once they have seen their own chart
          — and Swati starts the call already holding it. */}
      <div className="border-b border-brand/25 bg-brand-soft">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5">
          <p className="flex items-center gap-2.5 text-[0.86rem]">
            <Sparkles size={15} strokeWidth={1.8} className="shrink-0 text-brand" />
            <span>
              <strong className="font-medium">Get your birth chart free first.</strong>
              <span className="text-muted"> Swati will have it open during your call.</span>
            </span>
          </p>
          <Link to="/birth-chart" className="btn btn-primary btn-sm shrink-0">
            Draw my chart <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <div className="border-b border-line bg-bg2">
        <div className="wrap grid items-center gap-8 py-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow">Private consultation</p>
            <h1 className="mt-2.5 max-w-xl text-3xl leading-tight sm:text-4xl">
              Talk to Swati before you buy
            </h1>
            <p className="mt-4 max-w-lg text-[0.94rem] leading-relaxed text-muted">
              You speak to the certified astrologer whose name is on the door, not a call centre.
              The first fifteen minutes are free, because she would rather you were sure.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.82rem] text-muted">
              {['Completely confidential', 'Reschedule up to 4 hours before', 'Payment collected on the call'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <ShieldCheck size={13} strokeWidth={1.8} className="text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {[{ v: 900, s: '+', l: 'Readings given' }, { v: 98, s: '%', l: 'Would recommend' }, { v: 45, s: ' min', l: 'Average session' }].map((k) => (
              <div key={k.l}>
                <dt className="sr-only">{k.l}</dt>
                <dd>
                  <span className="block text-2xl font-semibold"><CountUp to={k.v} suffix={k.s} /></span>
                  <span className="mt-0.5 block text-[0.72rem] text-muted">{k.l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
        {/* stepper */}
        <ol className="mb-9 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[0.78rem] font-medium transition-colors sm:h-8 sm:w-8 ${
                  i < step ? 'border-brand bg-brand text-onbrand'
                  : i === step ? 'border-brand text-brand'
                  : 'border-line text-muted'
                }`}
              >
                {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
              </button>
              <span className={`hidden text-[0.78rem] sm:block ${i <= step ? 'text-ink' : 'text-muted'}`}>{s}</span>
              {i < STEPS.length - 1 && (
                <span className="ml-1 h-px flex-1 bg-line">
                  <motion.span className="block h-full bg-brand" initial={{ scaleX: 0 }} animate={{ scaleX: i < step ? 1 : 0 }} style={{ transformOrigin: 'left' }} transition={{ duration: 0.3 }} />
                </span>
              )}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          {/* -------------------------------------------------- 0 : service */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <h2 className="text-xl font-medium">Which consultation would help most?</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {(services.data || []).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setService(s); setStep(1); }}
                    className={`border p-6 text-left transition-colors ${
                      service?.id === s.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand'
                    }`}
                    style={{ borderRadius: 'var(--r-card)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-medium">{s.name}</h3>
                      {s.price === 0 && <span className="badge badge-ok">Free</span>}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[0.8rem] text-muted">
                      <Clock size={12} strokeWidth={1.8} /> {s.minutes} minutes
                    </p>
                    <p className="mt-4 text-2xl font-semibold tnum">{s.price ? inr(s.price) : 'Complimentary'}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-brand">
                      Select <ArrowRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ------------------------------------------------ 1 : date/time */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <h2 className="text-xl font-medium">Pick a date and time</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0}
                      className="grid h-10 w-10 place-items-center rounded-[var(--r-btn)] text-muted transition-colors hover:bg-bg2 disabled:opacity-30 sm:h-9 sm:w-9" aria-label="Previous month">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[0.95rem] font-medium">{calendar.label}</span>
                    <button onClick={() => setMonthOffset((m) => Math.min(2, m + 1))}
                      className="grid h-10 w-10 place-items-center rounded-[var(--r-btn)] text-muted transition-colors hover:bg-bg2 sm:h-9 sm:w-9" aria-label="Next month">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="mt-5 grid grid-cols-7 gap-1 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <span key={i} className="pb-2 text-[0.68rem] font-medium text-muted">{d}</span>
                    ))}
                    {calendar.cells.map((c, i) =>
                      c === null ? <span key={`e${i}`} /> : (
                        <button
                          key={c.key}
                          disabled={c.past || c.far}
                          onClick={() => { setDate(c.key); setSlot(null); }}
                          className={`relative aspect-square rounded-[var(--r-btn)] text-[0.85rem] transition-colors ${
                            date === c.key ? 'bg-brand text-onbrand'
                            : c.past || c.far ? 'text-muted/30'
                            : 'hover:bg-bg2'
                          }`}
                        >
                          {c.day}
                          {c.today && date !== c.key && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-4 text-[0.75rem] text-muted">Sunday mornings are reserved — afternoon slots only.</p>
                </div>

                <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
                  <h3 className="text-[0.95rem] font-medium">
                    {date ? dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Choose a date first'}
                  </h3>
                  {!date ? (
                    <p className="mt-3 text-[0.85rem] text-muted">Select a day on the left to see available times.</p>
                  ) : availability.loading ? (
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {Array.from({ length: 9 }, (_, i) => <div key={i} className="skeleton h-10 rounded-[var(--r-btn)]" />)}
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        {(availability.data?.slots || []).map((s) => (
                          <button
                            key={s.slot}
                            disabled={!s.available}
                            onClick={() => setSlot(s.slot)}
                            className={`rounded-[var(--r-btn)] border py-2.5 text-[0.85rem] transition-colors ${
                              slot === s.slot ? 'border-brand bg-brand text-onbrand'
                              : s.available ? 'border-line hover:border-brand'
                              : 'border-line text-muted/30 line-through'
                            }`}
                          >
                            {s.slot}
                          </button>
                        ))}
                      </div>
                      <p className="mt-4 text-[0.75rem] text-muted">Times shown in IST. Struck-through slots are taken.</p>
                    </>
                  )}

                  <div className="mt-6 border-t border-line pt-5">
                    <p className="field-label">How should she reach you?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'Video call', Icon: Video }, { id: 'Phone call', Icon: Phone }].map(({ id, Icon }) => (
                        <button
                          key={id}
                          onClick={() => setForm((f) => ({ ...f, mode: id }))}
                          className={`flex items-center justify-center gap-2 rounded-[var(--r-btn)] border py-2.5 text-[0.82rem] transition-colors ${
                            form.mode === id ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                          }`}
                        >
                          <Icon size={14} strokeWidth={1.7} /> {id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* -------------------------------------------------- 2 : details */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <h2 className="text-xl font-medium">A little about you</h2>
              <p className="mt-1.5 text-[0.88rem] text-muted">
                Birth details sharpen the reading considerably — leave them blank if you do not know them.
              </p>
              <div className="mt-6 grid gap-4 border border-line bg-surface p-6 sm:grid-cols-2" style={{ borderRadius: 'var(--r-card)' }}>
                <div>
                  <label className="field-label" htmlFor="bk-name">Your name</label>
                  <input id="bk-name" value={form.name} onChange={set('name')} className="field" placeholder="Ananya Sharma" />
                </div>
                <div>
                  <label className="field-label" htmlFor="bk-phone">Phone</label>
                  <input id="bk-phone" value={form.phone} onChange={set('phone')} className="field" placeholder="+91 90000 00000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="bk-email">Email</label>
                  <input id="bk-email" type="email" value={form.email} onChange={set('email')} className="field" placeholder="you@email.com" />
                </div>
                <div>
                  <label className="field-label" htmlFor="bk-bd">Date of birth</label>
                  <input id="bk-bd" type="date" value={form.birthDate} onChange={set('birthDate')} className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="bk-bt">Time of birth</label>
                  <input id="bk-bt" type="time" value={form.birthTime} onChange={set('birthTime')} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="bk-bp">Place of birth</label>
                  <input id="bk-bp" value={form.birthPlace} onChange={set('birthPlace')} className="field" placeholder="Meerut, Uttar Pradesh" />
                </div>
                <div className="sm:col-span-2">
                  <p className="field-label">What is this about?</p>
                  <div className="flex flex-wrap gap-2">
                    {CONCERNS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, concern: c }))}
                        className={`rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.8rem] transition-colors ${
                          form.concern === c ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="bk-notes">Anything she should know beforehand?</label>
                  <textarea id="bk-notes" rows={3} value={form.notes} onChange={set('notes')} className="field resize-none" placeholder="Optional, but it helps." />
                </div>
              </div>
            </motion.div>
          )}

          {/* -------------------------------------------------- 3 : confirm */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <h2 className="text-xl font-medium">Please confirm</h2>
              <div className="mt-6 border border-line bg-surface p-6" style={{ borderRadius: 'var(--r-card)' }}>
                <dl className="grid gap-5 sm:grid-cols-2">
                  {[
                    ['Service', service?.name],
                    ['Duration', `${service?.minutes} minutes`],
                    ['Date', date && dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })],
                    ['Time', `${slot} IST`],
                    ['Mode', form.mode],
                    ['Focus', form.concern],
                    ['Name', form.name],
                    ['Phone', form.phone],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[0.72rem] text-muted">{k}</dt>
                      <dd className="mt-0.5 text-[0.9rem]">{v || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                  <span className="text-[0.85rem] text-muted">Consultation fee</span>
                  <span className="text-2xl font-semibold tnum">{service?.price ? inr(service.price) : 'Free'}</span>
                </div>
                <p className="mt-4 flex items-start gap-2 text-[0.78rem] leading-relaxed text-muted">
                  <BadgeCheck size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
                  Payment is collected on the call itself. You can reschedule any time up to four hours beforehand.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wraps rather than overflows: on a 320px screen "Back" and "Confirm
            booking" cannot sit on one line, and a stepper that pushes its own
            buttons off-screen is unusable at exactly the moment it matters. */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-outline disabled:opacity-30">
            <ChevronLeft size={14} /> Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance} className="btn btn-primary btn-lg">
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={submit} disabled={saving} className="btn btn-primary btn-lg">
              {saving ? 'Confirming…' : 'Confirm booking'} <Check size={14} />
            </button>
          )}
        </div>

        <div className="mt-14 grid gap-6 border-t border-line pt-9 sm:grid-cols-3">
          {[
            { q: 'Do I need my exact birth time?', a: 'It helps, but Swati can work from date and place alone. Bring whatever you have.' },
            { q: 'Is the call recorded?', a: 'Only if you ask. Nothing is stored or shared otherwise.' },
            { q: 'What if I need to reschedule?', a: 'Call or message up to four hours before and we will move it, at no charge.' },
          ].map((f) => (
            <div key={f.q}>
              <p className="text-[0.88rem] font-medium">{f.q}</p>
              <p className="mt-1.5 text-[0.83rem] leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
