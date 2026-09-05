import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';

import { api } from '../lib/api.js';

/**
 * Address inputs with two shortcuts, shared by checkout and the profile so the
 * behaviour cannot drift between them.
 *
 *   1. Typing a six-digit PIN fills the city and state from India Post. This is
 *      the one that earns its keep — it is authoritative, instant, and a
 *      shopper always knows their own PIN.
 *   2. "Use my current location" asks the browser for coordinates and fills the
 *      city and state from them. Deliberately secondary: it needs a permission
 *      prompt, it can be a few kilometres out, and it returns no PIN in India.
 *
 * Neither ever overwrites something already typed without saying so, and both
 * degrade to plain typing if the lookup fails.
 */
export default function AddressFields({ value, onChange, idPrefix = 'ad', showState = true }) {
  const [pinState, setPinState] = useState('idle');   /* idle | looking | found | bad */
  const [pinNote, setPinNote] = useState('');
  const [locState, setLocState] = useState('idle');   /* idle | locating | done | denied */
  const [locNote, setLocNote] = useState('');
  const lastPin = useRef('');

  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });

  /* Fires only when six digits are present and only once per PIN, so holding
     backspace does not spray requests at the upstream. */
  useEffect(() => {
    const pin = String(value.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) { setPinState('idle'); setPinNote(''); return undefined; }
    if (pin === lastPin.current) return undefined;

    let cancelled = false;
    const t = setTimeout(async () => {
      setPinState('looking');
      try {
        const r = await api.pincode(pin);
        if (cancelled) return;
        lastPin.current = pin;
        if (!r.ok) { setPinState('bad'); setPinNote(r.error || 'Not found'); return; }
        setPinState('found');
        setPinNote(r.localities?.length ? `${r.city} · ${r.localities.slice(0, 3).join(', ')}` : r.city);
        onChange({ ...value, pincode: pin, city: r.city || value.city, state: r.state || value.state });
      } catch {
        if (!cancelled) { setPinState('idle'); setPinNote(''); }
      }
    }, 450);

    return () => { cancelled = true; clearTimeout(t); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [value.pincode]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocState('denied');
      setLocNote('This browser cannot share a location.');
      return;
    }
    setLocState('locating');
    setLocNote('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await api.reverseGeocode(coords.latitude, coords.longitude);
          if (!r.ok) { setLocState('denied'); setLocNote(r.error); return; }
          onChange({
            ...value,
            city: r.city || value.city,
            state: r.state || value.state,
            pincode: value.pincode || r.pincode || '',
          });
          setLocState('done');
          /* Honest about the limit rather than pretending the address is done. */
          setLocNote(`${r.city}, ${r.state} — add your street and PIN below.`);
        } catch {
          setLocState('denied');
          setLocNote('Could not look that up. Please type it in.');
        }
      },
      (err) => {
        setLocState('denied');
        setLocNote(err.code === 1
          ? 'Location permission was declined — please type your address.'
          : 'Could not get your location. Please type your address.');
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 }
    );
  };

  return (
    <>
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locState === 'locating'}
          className="btn btn-outline btn-sm"
        >
          {locState === 'locating'
            ? <><Loader2 size={13} className="animate-spin" /> Finding you…</>
            : <><MapPin size={13} /> Use my current location</>}
        </button>
        {locNote && (
          <p className={`mt-2 text-[0.78rem] ${locState === 'done' ? 'text-ok' : 'text-muted'}`}>
            {locNote}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`${idPrefix}-addr`}>Address</label>
        <textarea
          id={`${idPrefix}-addr`} rows={2} required
          className="field resize-none"
          value={value.address || ''} onChange={set('address')}
          autoComplete="street-address"
          placeholder="House / flat number, street, landmark"
        />
      </div>

      <div>
        <label className="field-label" htmlFor={`${idPrefix}-pin`}>PIN code</label>
        <div className="relative">
          <input
            id={`${idPrefix}-pin`} required
            className="field pr-9"
            value={value.pincode || ''} onChange={set('pincode')}
            autoComplete="postal-code" inputMode="numeric" maxLength={6}
            placeholder="250110"
          />
          {pinState === 'looking' && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />
          )}
          {pinState === 'found' && (
            <Check size={14} strokeWidth={2.4} className="absolute right-3 top-1/2 -translate-y-1/2 text-ok" />
          )}
        </div>
        {pinNote && (
          <p className={`mt-1.5 text-[0.76rem] ${pinState === 'bad' ? 'text-sale' : 'text-muted'}`}>{pinNote}</p>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor={`${idPrefix}-city`}>City</label>
        <input
          id={`${idPrefix}-city`} required
          className="field"
          value={value.city || ''} onChange={set('city')}
          autoComplete="address-level2" placeholder="Meerut"
        />
      </div>

      {showState && (
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor={`${idPrefix}-state`}>State</label>
          <input
            id={`${idPrefix}-state`} required
            className="field"
            value={value.state || ''} onChange={set('state')}
            autoComplete="address-level1" placeholder="Uttar Pradesh"
          />
        </div>
      )}
    </>
  );
}
