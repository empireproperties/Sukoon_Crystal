import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Video, Clock, IndianRupee, CalendarOff, Trash2 } from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Field, Toggle, ConfirmDelete, EmptyState } from './ui.jsx';

const DAYS = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];

/* Mirrors CONSULT_DEFAULTS in server/index.js. Kept in sync by hand; the server
   is the authority and merges whatever is missing here. */
const DEFAULTS = {
  slots: ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
  openDays: [1, 2, 3, 4, 5, 6],
  leadHours: 12,
  horizonDays: 30,
  blockedDates: [],
  meetingNote: 'You will receive a video call link by email and WhatsApp before your slot.',
};

/* ------------------------------------------------------------- services */
function ServiceRow({ svc, onChange, onSave, onDelete, saving }) {
  return (
    <div className="border border-line bg-surface p-4" style={{ borderRadius: 'var(--r-card)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className="field !text-[0.95rem] !font-medium"
            value={svc.name || ''}
            onChange={(e) => onChange({ ...svc, name: e.target.value })}
            placeholder="Consultation name"
          />
        </div>
        <Toggle
          checked={svc.active !== false}
          onChange={(v) => onChange({ ...svc, active: v })}
          label="Bookable"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Charge (₹)" hint="0 makes it a free call">
          <div className="relative">
            <IndianRupee size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="number" min="0" className="field !pl-8" value={svc.price ?? 0}
              onChange={(e) => onChange({ ...svc, price: Number(e.target.value) || 0 })} />
          </div>
        </Field>
        <Field label="Duration (minutes)">
          <div className="relative">
            <Clock size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="number" min="5" step="5" className="field !pl-8" value={svc.minutes ?? 30}
              onChange={(e) => onChange({ ...svc, minutes: Number(e.target.value) || 30 })} />
          </div>
        </Field>
        <Field label="Mode">
          <select className="field" value={svc.mode || 'Video call'}
            onChange={(e) => onChange({ ...svc, mode: e.target.value })}>
            <option>Video call</option>
            <option>Phone call</option>
            <option>In person</option>
          </select>
        </Field>
        <Field label="Short description" hint="Shown on the booking page" className="sm:col-span-3">
          <input className="field" value={svc.description || ''}
            onChange={(e) => onChange({ ...svc, description: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <button onClick={onSave} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <ConfirmDelete onConfirm={onDelete} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function AdminConsultations() {
  const { toast, settings, refreshSettings } = useShop();
  const [services, setServices] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [blockDate, setBlockDate] = useState('');

  useEffect(() => {
    api.allServices().then(setServices).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  useEffect(() => { if (settings && !cfg) setCfg({ ...DEFAULTS, ...(settings.consult || {}) }); }, [settings, cfg]);

  const saveCfg = async () => {
    setSaving('cfg');
    try {
      /* Slots are stored sorted so the booking page never shows 18:00 above
         10:00 just because of the order they were typed in. */
      await api.saveSettings({ consult: { ...cfg, slots: [...cfg.slots].sort() } });
      await refreshSettings();
      toast('Availability saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(''); }
  };

  const addService = async () => {
    try {
      const s = await api.createService({});
      setServices((l) => [...(l || []), s]);
    } catch (e) { toast(e.message, 'error'); }
  };

  const saveService = async (svc) => {
    setSaving(svc.id);
    try { await api.updateService(svc.id, svc); toast('Saved.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
    finally { setSaving(''); }
  };

  const removeService = async (id) => {
    try { await api.deleteService(id); setServices((l) => l.filter((s) => s.id !== id)); toast('Removed.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  if (!services || !cfg) return <div className="h-64 animate-pulse rounded bg-bg2" />;

  const toggleDay = (d) => setCfg((c) => ({
    ...c,
    openDays: c.openDays.includes(d) ? c.openDays.filter((x) => x !== d) : [...c.openDays, d].sort(),
  }));

  return (
    <div className="space-y-8">
      {/* --------------------------------------------------------- charges */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Consultation types &amp; charges</h2>
            <p className="mt-1 text-[0.84rem] text-muted">
              What a visitor can book, how long it runs and what it costs. The price is taken
              from here when a booking is made — never from the browser.
            </p>
          </div>
          <button onClick={addService} className="btn btn-primary shrink-0"><Plus size={15} /> Add type</button>
        </div>

        {!services.length ? (
          <EmptyState icon={Video} title="No consultation types"
            text="Add one so visitors can book a call."
            action={<button onClick={addService} className="btn btn-primary"><Plus size={15} /> Add type</button>} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {services.map((s) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ServiceRow
                  svc={s}
                  saving={saving === s.id}
                  onChange={(next) => setServices((l) => l.map((x) => (x.id === s.id ? next : x)))}
                  onSave={() => saveService(services.find((x) => x.id === s.id))}
                  onDelete={() => removeService(s.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- availability */}
      <section className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Swati’s availability</h2>
            <p className="mt-1 text-[0.84rem] text-muted">
              A slot disappears from the booking page the moment someone takes it.
            </p>
          </div>
          <button onClick={saveCfg} className="btn btn-primary" disabled={saving === 'cfg'}>
            <Save size={14} /> {saving === 'cfg' ? 'Saving…' : 'Save availability'}
          </button>
        </div>

        <div className="mt-6">
          <p className="field-label">Days you take calls</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {DAYS.map(([label, d]) => {
              const on = cfg.openDays.includes(d);
              return (
                <button key={d} onClick={() => toggleDay(d)}
                  className={`border px-4 py-2 text-[0.84rem] transition ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:bg-bg2'}`}
                  style={{ borderRadius: 'var(--r-btn)' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="field-label">Time slots</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {[...cfg.slots].sort().map((t) => (
              <span key={t} className="inline-flex items-center gap-2 border border-line px-3 py-1.5 text-[0.84rem]"
                style={{ borderRadius: 'var(--r-btn)' }}>
                {t}
                <button onClick={() => setCfg((c) => ({ ...c, slots: c.slots.filter((x) => x !== t) }))}
                  className="text-muted hover:text-sale" aria-label={`Remove ${t}`}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input type="time" className="field max-w-[160px]" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
            <button
              onClick={() => {
                if (!newSlot || cfg.slots.includes(newSlot)) return;
                setCfg((c) => ({ ...c, slots: [...c.slots, newSlot].sort() }));
                setNewSlot('');
              }}
              className="btn border border-line" disabled={!newSlot}
            >
              <Plus size={14} /> Add slot
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Minimum notice (hours)" hint="Nobody can book a call starting sooner than this">
            <input type="number" min="0" className="field" value={cfg.leadHours}
              onChange={(e) => setCfg((c) => ({ ...c, leadHours: Number(e.target.value) || 0 }))} />
          </Field>
          <Field label="Book up to (days ahead)">
            <input type="number" min="1" className="field" value={cfg.horizonDays}
              onChange={(e) => setCfg((c) => ({ ...c, horizonDays: Number(e.target.value) || 30 }))} />
          </Field>
          <Field label="Note shown after booking" className="sm:col-span-2">
            <input className="field" value={cfg.meetingNote}
              onChange={(e) => setCfg((c) => ({ ...c, meetingNote: e.target.value }))} />
          </Field>
        </div>

        {/* Holidays and days off, without having to switch the weekday off. */}
        <div className="mt-6 border-t border-line pt-5">
          <p className="field-label flex items-center gap-2"><CalendarOff size={13} /> Blocked dates</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {cfg.blockedDates.length === 0 && <span className="text-[0.82rem] text-muted">None</span>}
            {[...cfg.blockedDates].sort().map((d) => (
              <span key={d} className="inline-flex items-center gap-2 border border-line px-3 py-1.5 text-[0.84rem]"
                style={{ borderRadius: 'var(--r-btn)' }}>
                {d}
                <button onClick={() => setCfg((c) => ({ ...c, blockedDates: c.blockedDates.filter((x) => x !== d) }))}
                  className="text-muted hover:text-sale" aria-label={`Unblock ${d}`}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input type="date" className="field max-w-[200px]" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            <button
              onClick={() => {
                if (!blockDate || cfg.blockedDates.includes(blockDate)) return;
                setCfg((c) => ({ ...c, blockedDates: [...c.blockedDates, blockDate].sort() }));
                setBlockDate('');
              }}
              className="btn border border-line" disabled={!blockDate}
            >
              <Plus size={14} /> Block date
            </button>
          </div>
        </div>
      </section>

      <p className="text-[0.8rem] text-muted">
        Paid consultations are created as <strong className="text-ink">awaiting payment</strong> and only
        hold the slot once paid — which needs Razorpay keys in <code>server/.env</code>.
        Free consultations (charge&nbsp;₹0) confirm straight away.
      </p>
    </div>
  );
}
