import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, PenLine, Play, MessageSquare } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Stars } from './Ornaments.jsx';

/* ---------------------------------------------------------------- form */
function ReviewForm({ productId, onDone }) {
  const { toast } = useShop();
  const [form, setForm] = useState({ name: '', rating: 5, title: '', body: '', video: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.submitReview({ ...form, productId, rating: Number(form.rating) });
      toast(res.message, 'success');
      setForm({ name: '', rating: 5, title: '', body: '', video: '' });
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
      <p className="text-[0.92rem] font-medium">Write a review</p>
      <p className="mt-1 text-[0.78rem] text-muted">We read every one before it appears.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="rv-name">Your name</label>
          <input id="rv-name" className="field" value={form.name} onChange={set('name')} required maxLength={60} />
        </div>
        <div>
          <span className="field-label">Rating</span>
          <div className="flex gap-1 pt-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, rating: n }))}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                <Star size={22} strokeWidth={1.6}
                  className={n <= form.rating ? 'fill-accent text-accent' : 'text-line'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="rv-title">Headline <span className="text-muted">(optional)</span></label>
        <input id="rv-title" className="field" value={form.title} onChange={set('title')} maxLength={120} />
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="rv-body">Your review</label>
        <textarea id="rv-body" rows={4} className="field" value={form.body} onChange={set('body')} required maxLength={1500} />
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="rv-video">Video link <span className="text-muted">(optional)</span></label>
        <input id="rv-video" className="field" value={form.video} onChange={set('video')}
          placeholder="A YouTube or Instagram link" />
        <p className="mt-1 text-[0.72rem] text-muted">
          Paste a YouTube or Instagram link and we will show it as a video review.
        </p>
      </div>

      <button className="btn btn-primary mt-4" disabled={busy}>
        {busy ? 'Sending…' : 'Submit review'}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------- section */
export default function ProductReviews({ product }) {
  const [reviews, setReviews] = useState(null);
  const [writing, setWriting] = useState(false);

  const load = () => api.reviews({ product: product.id }).then(setReviews).catch(() => setReviews([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [product.id]);

  /* The distribution is computed from the reviews actually shown, so the bars
     can never disagree with the list beneath them. */
  const split = useMemo(() => {
    const list = reviews || [];
    return [5, 4, 3, 2, 1].map((stars) => {
      const n = list.filter((r) => r.rating === stars).length;
      return { stars, n, pct: list.length ? Math.round((n / list.length) * 100) : 0 };
    });
  }, [reviews]);

  const count = reviews?.length ?? 0;
  const average = count
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;

  return (
    <section id="reviews" className="border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted">Customer reviews</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[1.6rem] leading-tight">
            {count ? `${average} out of 5` : 'No reviews yet'}
          </h2>
          <p className="mt-1 text-[0.84rem] text-muted">
            {count ? `Based on ${count} published review${count > 1 ? 's' : ''} for this piece.`
                   : 'Be the first to share how this piece worked for you.'}
          </p>
        </div>
        <button onClick={() => setWriting((w) => !w)} className="btn border border-line">
          <PenLine size={14} /> {writing ? 'Close' : 'Write a review'}
        </button>
      </div>

      {writing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 overflow-hidden">
          <ReviewForm productId={product.id} onDone={() => { setWriting(false); load(); }} />
        </motion.div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <div className="flex items-end gap-4">
            <span className="text-[3rem] font-medium leading-none tnum">{average || '—'}</span>
            <div className="pb-1">
              <Stars rating={average} size={15} />
              <p className="mt-1 text-[0.79rem] text-muted">{count} review{count === 1 ? '' : 's'}</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2">
            {split.map((r) => (
              <li key={r.stars} className="flex items-center gap-3 text-[0.78rem]">
                <span className="flex w-8 items-center gap-1 text-muted tnum">
                  {r.stars} <Star size={10} className="fill-accent text-accent" />
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg2">
                  <motion.span className="block h-full rounded-full bg-accent"
                    initial={{ width: 0 }} whileInView={{ width: `${r.pct}%` }}
                    viewport={{ once: true }} transition={{ duration: 0.6 }} />
                </span>
                <span className="w-8 text-right text-muted tnum">{r.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        {!reviews ? (
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded bg-bg2" />)}</div>
        ) : !reviews.length ? (
          <div className="grid place-items-center border border-dashed border-line py-12 text-center" style={{ borderRadius: 'var(--r-card)' }}>
            <MessageSquare size={24} className="text-muted" strokeWidth={1.5} />
            <p className="mt-3 text-[0.88rem] text-muted">No published reviews for this piece yet.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-line pb-5 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars rating={r.rating} size={12} />
                  <span className="text-[0.88rem] font-medium">{r.name}</span>
                  <span className="text-[0.76rem] text-muted">{dateLabel(r.createdAt)}</span>
                  <span className="badge badge-ok ml-auto">Verified</span>
                </div>
                {r.title && <p className="mt-2 text-[0.9rem] font-medium">{r.title}</p>}
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted">{r.body}</p>
                {r.video && (
                  <a href={r.video.url} target="_blank" rel="noreferrer noopener"
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[0.8rem] text-accent hover:underline">
                    <Play size={12} className="fill-current" /> Watch their video
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
