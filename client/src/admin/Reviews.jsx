import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Check, X, Trash2, Play, MessageSquare, Pin, Plus } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { EmptyState, ConfirmDelete } from './ui.jsx';
import VideoPicker from '../components/VideoPicker.jsx';

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

const BLANK = { name: '', designation: '', rating: 5, title: '', body: '', video: '', productId: '', featured: false };

/**
 * A review the shop enters itself.
 *
 * Most of what customers actually say arrives by WhatsApp and Instagram, not
 * through the form on a product page. Without this those reviews simply never
 * reach the site, and the section sits on placeholder copy forever. Anything
 * entered here publishes immediately -- approval stands between a stranger and
 * the storefront, and the person filling this in is already past it.
 */
function AddReview({ onAdded, products = [] }) {
  const { toast } = useShop();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createReview({ ...form, rating: Number(form.rating), productId: form.productId || null });
      toast('Published. It is live on the storefront now.', 'success');
      setForm(BLANK);
      setOpen(false);
      onAdded();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        <Plus size={13} /> Add a review
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full border border-line bg-bg2 p-5"
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.95rem] font-medium">Add a review</p>
          <p className="mt-0.5 text-[0.78rem] text-muted">
            For the ones customers sent you on WhatsApp or Instagram. Publishes straight away.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="ar-name">Name</label>
          <input id="ar-name" className="field" value={form.name} onChange={set('name')} required maxLength={60} />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-role">
            Designation <span className="text-muted">(optional)</span>
          </label>
          <input
            id="ar-role" className="field" value={form.designation} onChange={set('designation')}
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
              <Star size={22} strokeWidth={1.6} className={n <= form.rating ? 'fill-accent text-accent' : 'text-line'} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="ar-title">Headline <span className="text-muted">(optional)</span></label>
        <input id="ar-title" className="field" value={form.title} onChange={set('title')} maxLength={120} />
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="ar-body">What they said</label>
        <textarea id="ar-body" rows={3} className="field" value={form.body} onChange={set('body')} required maxLength={1500} />
      </div>

      {/* The piece this review is about. Attaching it puts the bracelet, its
          price and an Add to cart button on the review card, so someone
          watching the clip can buy the exact piece being worn. */}
      <div className="mt-3">
        <label className="field-label" htmlFor="ar-product">
          Which product is it about? <span className="text-muted">(optional)</span>
        </label>
        <select id="ar-product" className="field" value={form.productId} onChange={set('productId')}>
          <option value="">No product — just the review</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <span className="field-label">Their video <span className="text-muted">(optional)</span></span>
        <p className="-mt-0.5 mb-2.5 text-[0.75rem] leading-snug text-muted">
          Upload the clip they sent you. It is stored on our own Cloudflare
          bucket, so it cannot vanish the way someone else’s link can.
          A review with a video goes to the front of the homepage rail.
        </p>
        <VideoPicker
          admin
          label="Upload their clip"
          value={form.video}
          onChange={(url) => setForm((f) => ({ ...f, video: url }))}
          disabled={saving}
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-[0.84rem]">
        <input
          type="checkbox" checked={form.featured}
          onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
        />
        Pin it to the front of the homepage rail
      </label>

      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Publishing…' : 'Publish review'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-sm border border-line">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminReviews() {
  const { toast } = useShop();
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');

  /* Every product, including hidden ones: a review can be about a piece that
     is temporarily out of the shop. `|| []` rather than a destructuring
     default -- useAsync starts at data: null, and a default only fills in for
     undefined, so the list would be null on the first render. */
  const { data: productData } = useAsync(() => api.products({ all: '1' }), []);
  const products = productData || [];

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
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[0.86rem] transition ${
              tab === id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto pb-2">
          <AddReview products={products} onAdded={() => { setTab('approved'); load(); }} />
        </span>
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
                    {r.designation && <span className="text-[0.76rem] text-muted">{r.designation}</span>}
                    <Stars n={r.rating} />
                    {r.video && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bg2 px-2 py-0.5 text-[0.68rem] text-muted">
                        <Play size={9} className="fill-current" />
                        {r.video.kind === 'file' ? r.video.storage || 'video' : r.video.kind}
                      </span>
                    )}
                    {r.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[0.68rem] text-accent">
                        <Pin size={9} /> Pinned
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[0.74rem] text-muted">
                    {dateLabel(r.createdAt)}{r.source === 'admin' ? ' · added by you' : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] ${
                  r.status === 'approved' ? 'bg-brand/10 text-brand'
                  : r.status === 'rejected' ? 'bg-sale/10 text-sale' : 'bg-bg2 text-muted'}`}>
                  {r.status}
                </span>
              </div>

              {r.title && <p className="mt-3 text-[0.9rem] font-medium">{r.title}</p>}
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{r.body}</p>

              {r.video?.kind === 'file' ? (
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <video
                    src={r.video.embed}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[260px] w-[180px] rounded bg-black object-contain"
                  />
                  <div className="min-w-0 flex-1 text-[0.74rem] text-muted">
                    <p>
                      Stored on <strong className="text-ink">{r.video.storage || 'unknown'}</strong>.
                      {r.video.storage === 'external' && ' Hosted by someone else, so it can change or vanish.'}
                      {r.video.storage === 'local' && ' On the API server\u2019s own disk, which a redeploy wipes.'}
                    </p>
                    <a href={r.video.url} target="_blank" rel="noreferrer noopener"
                      className="mt-1 inline-block break-all text-accent underline underline-offset-2">
                      {r.video.url}
                    </a>
                  </div>
                </div>
              ) : r.video ? (
                <a href={r.video.url} target="_blank" rel="noreferrer noopener"
                  className="mt-2 inline-block break-all text-[0.76rem] text-accent underline underline-offset-2">
                  {r.video.url}
                </a>
              ) : null}

              {/* Attaching a product here as well as on the add form: most
                  reviews arrive from the storefront with no product against
                  them, and this is where they are read. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[0.74rem] text-muted" htmlFor={`prod-${r.id}`}>Sells</label>
                <select
                  id={`prod-${r.id}`}
                  className="field !h-8 !py-0 max-w-[260px] text-[0.78rem]"
                  value={r.productId || ''}
                  disabled={busy === r.id}
                  onChange={(e) => act(r.id, { productId: e.target.value || null })}
                >
                  <option value="">Nothing attached</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

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
