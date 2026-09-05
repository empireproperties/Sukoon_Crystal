import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Check, Camera, Loader2, Trash2, PackageX, Wrench, Replace, Ruler, MessageSquareMore, ShieldCheck,
} from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';

const MAX_PHOTOS = 4;

/* An icon and a plain sentence per reason. `needsDetail` marks the ones where
   the label alone tells Swati nothing — "Other" is meaningless without the
   customer's own words, so choosing it opens a required box. */
const REASONS = [
  { id: 'Arrived broken or damaged', icon: PackageX, hint: 'Cracked, snapped or damaged in transit' },
  { id: 'Manufacturing defect', icon: Wrench, hint: 'A loose bead, a broken thread, a fault in the piece' },
  { id: 'Wrong item delivered', icon: Replace, hint: 'Not what was ordered' },
  { id: 'Wrong size delivered', icon: Ruler, hint: 'The right piece, the wrong size' },
  { id: 'Something else', icon: MessageSquareMore, hint: 'Tell us in your own words', needsDetail: true },
];

export default function ReturnDialog({ order, onClose, onDone }) {
  const { toast } = useShop();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const detailRef = useRef(null);

  const chosen = REASONS.find((r) => r.id === reason);
  const detailRequired = Boolean(chosen?.needsDetail);
  const canSubmit = reason && (!detailRequired || details.trim().length >= 5) && !busy && !uploading;

  /* Escape closes, and the body must not scroll behind a modal. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  /* Picking "Something else" puts the cursor where the answer has to go. */
  useEffect(() => {
    if (detailRequired) detailRef.current?.focus();
  }, [detailRequired]);

  /* A photo is the most useful thing on a damage claim — it usually settles the
     decision with no back-and-forth. Uploaded one at a time so a slow
     connection shows progress instead of appearing to hang. */
  const addPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) return toast(`Up to ${MAX_PHOTOS} photos.`, 'warn');

    setUploading(true);
    try {
      const { url } = await api.uploadReturnPhoto(file);
      setPhotos((p) => [...p, url]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await api.requestReturn({ orderId: order.id, reason, details, photos, items: order.items });
      toast('Return raised. We will respond within 2 business days.', 'success');
      onDone?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const items = order.items || [];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ret-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        /* Full-height sheet on a phone, centred card on a desktop. */
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[var(--shadow-pop)] sm:rounded-b-2xl"
      >
        {/* ------------------------------------------------------- header */}
        <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
          {items[0]?.image && (
            <img src={items[0].image} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="ret-title" className="text-[1.15rem] leading-snug">Return {order.number}</h2>
            <p className="mt-0.5 truncate text-[0.82rem] text-muted">
              {items.length ? items[0].name : 'Order'}
              {items.length > 1 ? ` + ${items.length - 1} more` : ''} · {inr(order.total)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-bg2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* --------------------------------------------------------- body */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <fieldset>
              <legend className="text-[0.82rem] font-medium">What went wrong?</legend>
              <div className="mt-3 space-y-2">
                {REASONS.map((r) => {
                  const on = reason === r.id;
                  return (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-start gap-3 border p-3.5 transition-colors ${
                        on ? 'border-brand bg-brand-soft' : 'border-line hover:bg-bg2'
                      }`}
                      style={{ borderRadius: 'var(--r-btn)' }}
                    >
                      <input
                        type="radio" name="reason" value={r.id} checked={on}
                        onChange={() => setReason(r.id)} className="sr-only"
                      />
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                          on ? 'border-brand bg-brand text-white' : 'border-line text-transparent'
                        }`}
                      >
                        <Check size={11} strokeWidth={3.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-2 text-[0.9rem] ${on ? 'font-medium' : ''}`}>
                          <r.icon size={15} strokeWidth={1.8} className={on ? 'text-brand' : 'text-muted'} />
                          {r.id}
                        </span>
                        <span className="mt-0.5 block text-[0.78rem] leading-snug text-muted">{r.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* The detail box is always available, but becomes required — and
                opens itself — when the reason alone does not explain anything. */}
            <AnimatePresence initial={false}>
              {reason && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24 }}
                  className="overflow-hidden"
                >
                  <div className="pt-5">
                    <label className="field-label" htmlFor="ret-details">
                      {detailRequired ? 'Tell us what happened' : 'Anything else?'}
                      {!detailRequired && <span className="ml-1 text-muted">(optional)</span>}
                    </label>
                    <textarea
                      ref={detailRef}
                      id="ret-details"
                      rows={3}
                      className="field resize-none"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      required={detailRequired}
                      maxLength={1200}
                      placeholder={detailRequired
                        ? 'Describe the problem in a sentence or two'
                        : 'Anything that would help us understand'}
                    />
                    {detailRequired && details.trim().length > 0 && details.trim().length < 5 && (
                      <p className="mt-1.5 text-[0.76rem] text-sale">Please add a little more detail.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* --------------------------------------------------- photos */}
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-[0.82rem] font-medium">
                Photos <span className="font-normal text-muted">· optional, up to {MAX_PHOTOS}</span>
              </p>
              <p className="mt-0.5 text-[0.78rem] leading-snug text-muted">
                A picture of the problem usually settles it without us needing to ask.
              </p>

              <div className="mt-3 flex flex-wrap gap-2.5">
                {photos.map((url) => (
                  <motion.div
                    key={url}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                  >
                    <img src={url} alt="" className="h-20 w-20 rounded border border-line object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((x) => x !== url))}
                      aria-label="Remove photo"
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-bg shadow transition-transform hover:scale-110"
                    >
                      <Trash2 size={11} />
                    </button>
                  </motion.div>
                ))}

                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="grid h-20 w-20 place-items-center gap-1 border border-dashed border-line text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                    style={{ borderRadius: 'var(--r-btn)' }}
                  >
                    {uploading
                      ? <Loader2 size={18} className="animate-spin" />
                      : <><Camera size={18} strokeWidth={1.7} /><span className="text-[0.66rem]">Add</span></>}
                  </button>
                )}
              </div>

              <input
                ref={fileRef} type="file" hidden onChange={addPhoto}
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              />
            </div>
          </div>

          {/* ------------------------------------------------------ footer */}
          <div className="shrink-0 border-t border-line bg-bg2 p-5 sm:p-6">
            <p className="mb-3 flex items-start gap-2 text-[0.76rem] leading-relaxed text-muted">
              <ShieldCheck size={13} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ok" />
              We reply within 2 business days. Nothing is charged for raising a return.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="btn flex-1 border border-line">
                Cancel
              </button>
              <button className="btn btn-primary flex-[2] justify-center disabled:opacity-40" disabled={!canSubmit}>
                {busy ? 'Sending…' : 'Raise return request'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
