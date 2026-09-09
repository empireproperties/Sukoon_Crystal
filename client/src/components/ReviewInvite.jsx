import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Sparkles } from 'lucide-react';

import { api } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import VideoPicker, { MAX_VIDEO_MB } from './VideoPicker.jsx';

/* Which orders this browser has already been asked about. Kept per order rather
   than as one flag, so a second delivery still gets its own invitation, and kept
   locally rather than on the order because dismissing a prompt is a preference
   of this browser, not a fact about the order worth writing to the database. */
const ASKED_KEY = 'sukoon_review_asked';

const asked = () => {
  try { return JSON.parse(localStorage.getItem(ASKED_KEY)) || []; } catch { return []; }
};
const remember = (id) => {
  try { localStorage.setItem(ASKED_KEY, JSON.stringify([...new Set([...asked(), id])].slice(-40))); }
  catch { /* private window, or storage full. Worst case we ask twice. */ }
};

/**
 * The prompt a customer sees once their order has arrived.
 *
 * Asking at delivery is the entire point: it is the one moment the person has
 * the piece in their hands and an opinion about it. A review request sent any
 * other time is asking them to remember how they felt.
 *
 * Nothing written here is published. It goes into the same pending queue as any
 * other public review and waits for Admin > Reviews, which is what stops the
 * homepage from being whatever a stranger typed.
 */
export default function ReviewInvite({ order, onClose }) {
  const { toast } = useShop();
  const items = useMemo(() => order?.items || [], [order]);

  const [form, setForm] = useState({
    name: order?.customer?.name || '',
    designation: '',
    rating: 5,
    title: '',
    body: '',
    upload: '',
    productId: items[0]?.productId || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* Escape closes it, like every other dialog on the site. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { upload, ...rest } = form;
      const res = await api.submitReview({ ...rest, video: upload, rating: Number(form.rating) });
      toast(res.message, 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share a review"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto bg-surface"
        style={{ borderRadius: 'var(--r-card)' }}
      >
        <div className="flex items-start justify-between gap-3 bg-brand px-6 py-5 text-onbrand">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.22em] opacity-80">
              <Sparkles size={12} /> It has arrived
            </span>
            <h2 className="mt-2 font-[var(--font-display)] text-[1.5rem] leading-tight">
              How is it treating you?
            </h2>
            <p className="mt-1.5 text-[0.84rem] leading-relaxed opacity-85">
              A few words, or a short clip of it on your wrist. We read every one
              before it goes on the site.
            </p>
          </div>
          <button onClick={onClose} aria-label="Not now" className="shrink-0 opacity-70 transition hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          {items.length > 1 && (
            <div className="mb-3">
              <label className="field-label" htmlFor="ri-item">Which piece?</label>
              <select id="ri-item" className="field" value={form.productId} onChange={set('productId')}>
                {items.map((i) => (
                  <option key={i.productId} value={i.productId}>{i.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="ri-name">Your name</label>
              <input id="ri-name" className="field" value={form.name} onChange={set('name')} required maxLength={60} />
            </div>
            <div>
              <label className="field-label" htmlFor="ri-role">
                What you do <span className="text-muted">(optional)</span>
              </label>
              <input
                id="ri-role" className="field" value={form.designation} onChange={set('designation')}
                maxLength={80} placeholder="Yoga teacher, Delhi"
              />
            </div>
          </div>

          <div className="mt-3">
            <span className="field-label">Rating</span>
            <div className="flex gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star size={24} strokeWidth={1.6} className={n <= form.rating ? 'fill-accent text-accent' : 'text-line'} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="field-label" htmlFor="ri-body">Your review</label>
            <textarea id="ri-body" rows={3} className="field" value={form.body} onChange={set('body')} required maxLength={1500} />
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <span className="field-label">Add a video <span className="text-muted">(optional)</span></span>
            <p className="-mt-0.5 mb-2.5 text-[0.75rem] leading-snug text-muted">
              A clip of the piece in your hands says more than a paragraph.
              Up to {MAX_VIDEO_MB}MB, about a minute.
            </p>
            <VideoPicker
              value={form.upload}
              onChange={(url) => setForm((f) => ({ ...f, upload: url }))}
              disabled={busy}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send my review'}
            </button>
            <button type="button" onClick={onClose} className="btn border border-line">
              Not now
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/**
 * Picks the order worth asking about, and remembers that we asked.
 *
 * Returns `[order, dismiss]`. One prompt per visit at most: two dialogs in a row
 * over a two-item order is how a shop teaches people to close things unread.
 */
export function useReviewInvite(orders) {
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!orders?.length) return;
    const seen = asked();
    const candidate = orders.find((o) => o.status === 'delivered' && !seen.includes(o.id));
    if (!candidate) return;

    /* A beat after the page settles. Immediately would land while the order
       list is still animating in, and read as an interruption rather than a
       response to having received something. */
    const t = setTimeout(() => {
      setInvite(candidate);
      remember(candidate.id);
    }, 1200);
    return () => clearTimeout(t);
  }, [orders]);

  return [invite, () => setInvite(null)];
}

/** The same invitation as a button, for anyone who dismissed the dialog or
 *  came back later. */
export function ReviewInviteButton({ order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline btn-sm mt-4 sm:mt-0">
        <Star size={13} /> Share a review
      </button>
      <AnimatePresence>
        {open && <ReviewInvite order={order} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
