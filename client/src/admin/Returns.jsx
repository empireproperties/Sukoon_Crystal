import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Package, Mail, Phone } from 'lucide-react';

import { api, dateLabel, inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { EmptyState, Field } from './ui.jsx';

/* Mirrors RETURN_STATUSES in server/index.js. Ordered as the process actually
   runs, so the buttons read as a path rather than a menu. */
const FLOW = [
  ['requested', 'Requested'],
  ['approved', 'Approved'],
  ['picked_up', 'Picked up'],
  ['refunded', 'Refunded'],
  ['replaced', 'Replaced'],
  ['closed', 'Closed'],
];
const ALL = [...FLOW, ['rejected', 'Rejected']];

const TABS = [['requested', 'New'], ['approved', 'In progress'], ['all', 'Everything']];

const TONE = {
  requested: 'bg-accent/12 text-accent',
  approved: 'bg-brand/10 text-brand',
  rejected: 'bg-sale/10 text-sale',
  refunded: 'bg-brand/10 text-brand',
  replaced: 'bg-brand/10 text-brand',
};

export default function AdminReturns() {
  const { toast } = useShop();
  const [tab, setTab] = useState('requested');
  const [list, setList] = useState(null);
  const [notes, setNotes] = useState({});

  const load = () => api.returns(tab).then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { setList(null); load(); /* eslint-disable-next-line */ }, [tab]);

  const move = async (r, status) => {
    try {
      await api.updateReturn(r.id, { status, note: notes[r.id] || '', resolution: notes[r.id] || r.resolution });
      setNotes((n) => ({ ...n, [r.id]: '' }));
      await load();
      toast(`Marked ${status.replace('_', ' ')}.`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[0.86rem] transition ${
              tab === id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {!list ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded bg-bg2" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={RotateCcw} title="No returns" text="Return requests raised by customers appear here." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.95rem] font-medium">{r.number}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-muted">
                    <span className="inline-flex items-center gap-1"><Package size={12} /> {r.orderNumber}</span>
                    <span>{dateLabel(r.createdAt)}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] ${TONE[r.status] || 'bg-bg2 text-muted'}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <p className="field-label">Customer</p>
                  <p className="text-[0.88rem]">{r.customerName}</p>
                  <p className="mt-1 flex flex-col gap-1 text-[0.78rem] text-muted">
                    <a href={`mailto:${r.customerEmail}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                      <Mail size={11} /> {r.customerEmail}
                    </a>
                  </p>
                </div>
                <div>
                  <p className="field-label">Reason</p>
                  <p className="text-[0.88rem]">{r.reason}</p>
                  {r.details && <p className="mt-1 text-[0.8rem] text-muted">{r.details}</p>}
                </div>
              </div>

              {/* The whole point of collecting these is that Swati can look at
                  them, so they open full size in a new tab. */}
              {r.photos?.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="field-label">Photos from the customer</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {r.photos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer noopener"
                         className="block overflow-hidden rounded border border-line transition hover:opacity-85">
                        <img src={url} alt="" className="h-24 w-24 object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {r.items?.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {r.items.map((it, i) => (
                    <li key={i} className="flex justify-between text-[0.8rem] text-muted">
                      <span className="truncate">{it.name} × {it.qty}</span>
                      <span>{inr((it.price || 0) * (it.qty || 1))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {r.history?.length > 1 && (
                <ol className="mt-3 space-y-1 border-t border-line pt-3">
                  {r.history.map((h, i) => (
                    <li key={i} className="text-[0.74rem] text-muted">
                      <span className="text-ink">{h.status.replace(/_/g, ' ')}</span> · {dateLabel(h.at)} — {h.note}
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-4 border-t border-line pt-4">
                <Field label="Note to record with the next step">
                  <input className="field" value={notes[r.id] || ''} placeholder="Approved — reverse pickup arranged for Thursday."
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL.filter(([s]) => s !== r.status).map(([s, label]) => (
                    <button key={s} onClick={() => move(r, s)}
                      className={`btn btn-sm ${s === 'rejected' ? 'border border-sale/40 text-sale' : 'border border-line'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
