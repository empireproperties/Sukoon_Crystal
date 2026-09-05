import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Check, X, Trash2, Play, MessageSquare, Pin } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { EmptyState, ConfirmDelete } from './ui.jsx';

const TABS = [
  ['pending', 'Awaiting review'],
  ['approved', 'Published'],
  ['rejected', 'Rejected'],
  ['all', 'Everything'],
];

function Stars({ n }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} strokeWidth={1.7}
          className={i <= n ? 'fill-accent text-accent' : 'text-line'} />
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const { toast } = useShop();
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => api.allReviews(tab).then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { setList(null); load(); /* eslint-disable-next-line */ }, [tab]);

  const act = async (id, patch) => {
    setBusy(id);
    try {
      await api.updateReview(id, patch);
      /* Product star ratings are recomputed server-side from approved reviews,
         so the list is reloaded rather than patched in place. */
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async (id) => {
    try { await api.deleteReview(id); await load(); toast('Review deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
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
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded bg-bg2" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={MessageSquare} title="Nothing here"
          text={tab === 'pending' ? 'No reviews are waiting. New submissions land here first.' : 'No reviews with this status.'} />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[0.92rem] font-medium">{r.name}</span>
                    <Stars n={r.rating} />
                    {r.video && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bg2 px-2 py-0.5 text-[0.68rem] text-muted">
                        <Play size={9} className="fill-current" /> {r.video.kind}
                      </span>
                    )}
                    {r.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[0.68rem] text-accent">
                        <Pin size={9} /> Pinned
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[0.74rem] text-muted">{dateLabel(r.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] ${
                  r.status === 'approved' ? 'bg-brand/10 text-brand'
                  : r.status === 'rejected' ? 'bg-sale/10 text-sale' : 'bg-bg2 text-muted'}`}>
                  {r.status}
                </span>
              </div>

              {r.title && <p className="mt-3 text-[0.9rem] font-medium">{r.title}</p>}
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{r.body}</p>

              {r.video && (
                <a href={r.video.url} target="_blank" rel="noreferrer noopener"
                  className="mt-2 inline-block break-all text-[0.76rem] text-accent underline underline-offset-2">
                  {r.video.url}
                </a>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {r.status !== 'approved' && (
                  <button onClick={() => act(r.id, { status: 'approved' })} disabled={busy === r.id}
                    className="btn btn-primary btn-sm"><Check size={13} /> Publish</button>
                )}
                {r.status !== 'rejected' && (
                  <button onClick={() => act(r.id, { status: 'rejected' })} disabled={busy === r.id}
                    className="btn btn-sm border border-line"><X size={13} /> Reject</button>
                )}
                {r.status === 'approved' && (
                  <button onClick={() => act(r.id, { featured: !r.featured })} disabled={busy === r.id}
                    className="btn btn-sm border border-line">
                    <Pin size={13} /> {r.featured ? 'Unpin' : 'Pin to front'}
                  </button>
                )}
                <div className="ml-auto"><ConfirmDelete onConfirm={() => remove(r.id)} /></div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
