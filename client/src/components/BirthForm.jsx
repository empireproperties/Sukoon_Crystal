import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock, MapPin, Loader2, Sparkles, Check, Search } from 'lucide-react';

import { api } from '../lib/api.js';

/**
 * Three questions, asked the way a person would ask them.
 *
 * The place field is the one that usually goes wrong: a chart is only as
 * accurate as its longitude, so a free-text town name is not good enough. The
 * field searches a gazetteer and takes the latitude, longitude and timezone
 * from whichever row is picked — the shopper only ever sees "Meerut, Uttar
 * Pradesh".
 */
export default function BirthForm({ initial, onSubmit, busy, submitLabel = 'Draw my chart' }) {
  const [date, setDate] = useState(initial?.date || '');
  const [time, setTime] = useState(initial?.time || '');
  const [timeKnown, setTimeKnown] = useState(initial?.timeKnown !== false);
  const [place, setPlace] = useState(initial?.place || null);

  const [q, setQ] = useState(initial?.place?.name || '');
  const [rows, setRows] = useState(null);
  const [looking, setLooking] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const ready = date && (!timeKnown || time) && place;

  /* Debounced, because every keystroke that reached the server would be a
     calculation we cannot spare — and the answer barely changes between
     "meeru" and "meerut". */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3 || (place && term === placeLabel(place))) { setRows(null); return undefined; }
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await api.cities(term);
        setRows(results);
        setOpen(true);
      } catch {
        setRows([]);
      } finally {
        setLooking(false);
      }
    }, 450);
    return () => { clearTimeout(t); setLooking(false); };
  }, [q, place]);

  /* Clicking anywhere else puts the suggestions away. */
  useEffect(() => {
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const choose = (row) => {
    setPlace(row);
    setQ(placeLabel(row));
    setOpen(false);
    setRows(null);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    onSubmit({ date, time: timeKnown ? time : '', timeKnown, place });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="b-date">
            <CalendarDays size={12} className="mr-1.5 inline align-[-1px]" /> Date of birth
          </label>
          <input
            id="b-date" type="date" className="field" value={date} max={today}
            onChange={(e) => setDate(e.target.value)} required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="b-time">
            <Clock size={12} className="mr-1.5 inline align-[-1px]" /> Time of birth
          </label>
          <input
            id="b-time" type="time" className="field disabled:opacity-45"
            value={time} onChange={(e) => setTime(e.target.value)}
            disabled={!timeKnown} required={timeKnown}
          />
        </div>
      </div>

      {/* Not knowing your birth time is completely ordinary, and pretending
          otherwise makes people invent one — which is far worse for the chart
          than saying so. */}
      <label className="flex cursor-pointer items-start gap-2.5 text-[0.82rem]">
        <input
          type="checkbox" checked={!timeKnown}
          onChange={(e) => setTimeKnown(!e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
        />
        <span>
          I don’t know my birth time
          <span className="mt-0.5 block text-[0.76rem] leading-snug text-muted">
            Your moon sign and birth star will still be right. Only the rising sign needs the exact minute.
          </span>
        </span>
      </label>

      <div ref={boxRef} className="relative">
        <label className="field-label" htmlFor="b-place">
          <MapPin size={12} className="mr-1.5 inline align-[-1px]" /> Place of birth
        </label>
        <div className="relative">
          <input
            id="b-place" className="field !pr-10" placeholder="Start typing your town or city"
            value={q} autoComplete="off"
            onChange={(e) => { setQ(e.target.value); setPlace(null); }}
            onFocus={() => rows?.length && setOpen(true)}
            required
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
            {looking ? <Loader2 size={14} className="animate-spin" />
              : place ? <Check size={14} className="text-ok" />
              : <Search size={14} />}
          </span>
        </div>

        <AnimatePresence>
          {open && rows && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto border border-line bg-surface shadow-[var(--shadow-pop)]"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              {rows.length === 0 ? (
                <li className="px-4 py-3 text-[0.82rem] text-muted">
                  Nothing found. Try the nearest larger town.
                </li>
              ) : rows.map((r) => (
                <li key={`${r.name}-${r.lat}-${r.lng}`}>
                  <button
                    type="button" onClick={() => choose(r)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg2"
                  >
                    <span className="text-[0.88rem]">{r.name}</span>
                    <span className="shrink-0 text-[0.74rem] text-muted">
                      {[r.state, r.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {place && (
          <p className="mt-1.5 text-[0.74rem] text-muted">
            {place.lat.toFixed(2)}°, {place.lng.toFixed(2)}° · {place.tz}
          </p>
        )}
      </div>

      <button className="btn btn-primary btn-lg w-full disabled:opacity-40" disabled={!ready || busy}>
        {busy
          ? <><Loader2 size={16} className="animate-spin" /> Drawing your chart…</>
          : <><Sparkles size={16} strokeWidth={1.8} /> {submitLabel}</>}
      </button>
    </form>
  );
}

export const placeLabel = (p) => [p?.name, p?.state].filter(Boolean).join(', ');
