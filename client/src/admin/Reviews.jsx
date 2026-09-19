import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Check, X, Trash2, Play, MessageSquare, Pin, Plus, ChevronDown } from 'lucide-react';

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

/* rating 0 means "none given". A video review does not need stars, and
   defaulting to five put a rating on every clip that nobody actually gave. */
const BLANK = { name: '', designation: '', rating: 0, title: '', body: '', video: '', productId: '', featured: false };

/**
 * Every clip in the storage bucket, shown straight away.
 *
 * Not behind a button: these are the clips, and hiding them behind "browse"
 * made picking one a decision before it was a choice. Clicking a clip attaches
 * it, clicking it again lets it go.
 *
 * Thumbnails are the videos themselves at `preload="metadata"` -- a few
 * kilobytes each, the first frame, not the whole file.
 */
function BucketClips({ value, onPick }) {
  const { toast } = useShop();
  const [clips, setClips] = useState(null);

  useEffect(() => {
    let alive = true;
    api.reviewVideos()
      .then((c) => { if (alive) setClips(c); })
      .catch((e) => { if (alive) { setClips([]); toast(e.message, 'error'); } });
    return () => { alive = false; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (!clips) return <p className="mt-3 text-[0.78rem] text-muted">Reading your clips…</p>;
  if (!clips.length) return null;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {clips.map((c) => {
        const chosen = value === c.url;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(chosen ? '' : c.url)}
            className={`overflow-hidden border-2 transition ${chosen ? 'border-brand' : 'border-line hover:border-muted'}`}
            style={{ borderRadius: 'var(--r-btn)' }}
          >
            <video src={c.url} muted playsInline preload="metadata" tabIndex={-1}
              className="h-24 w-full bg-black object-cover" />
            <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-[0.66rem] text-muted">
              {c.sizeMb}MB
              {chosen && <Check size={11} strokeWidth={2.6} className="text-brand" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
  /* Name, stars and words are folded away. A clip needs none of them, and an
     open field asks to be filled in -- which is how reviews end up carrying
     words the customer never said. */
  const [details, setDetails] = useState(false);
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
            Pick a clip, say which bracelet it is about, publish.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
          <X size={16} />
        </button>
      </div>

      {/* The clip comes first because it is the review. */}
      <div className="mt-4">
        <VideoPicker
          admin
          label="Upload a clip"
          value={form.video}
          onChange={(url) => setForm((f) => ({ ...f, video: url }))}
          disabled={saving}
        />
        <BucketClips value={form.video} onPick={(url) => setForm((f) => ({ ...f, video: url }))} />
      </div>

      {/* Attaching the piece puts it on the card with an Add to cart button,
          so someone watching the clip can buy what they are looking at. */}
      <div className="mt-4">
        <label className="field-label" htmlFor="ar-product">Which bracelet is it about?</label>
        <select id="ar-product" className="field" value={form.productId} onChange={set('productId')}>
          <option value="">No product — just the review</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setDetails((d) => !d)}
        className="mt-3 flex items-center gap-1 text-[0.78rem] text-muted underline-offset-2 hover:text-ink"
      >
        <ChevronDown size={13} className={`transition-transform ${details ? 'rotate-180' : ''}`} />
        Name, rating and words (optional)
      </button>

      {details && (
        <div className="mt-2 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="ar-name">Name</label>
              <input id="ar-name" className="field" value={form.name} onChange={set('name')} maxLength={60} />
            </div>
            <div>
              <label className="field-label" htmlFor="ar-role">Designation</label>
              <input
                id="ar-role" className="field" value={form.designation} onChange={set('designation')}
                maxLength={80} placeholder="Yoga teacher, Delhi"
              />
            </div>
          </div>

          <div className="mt-3">
            <span className="field-label">Rating</span>
            <div className="flex items-center gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star size={22} strokeWidth={1.6} className={n <= form.rating ? 'fill-accent text-accent' : 'text-line'} />
                </button>
              ))}
              {form.rating > 0 && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, rating: 0 }))}
                  className="ml-2 text-[0.74rem] text-muted underline underline-offset-2 hover:text-ink">
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <label className="field-label" htmlFor="ar-title">Headline</label>
            <input id="ar-title" className="field" value={form.title} onChange={set('title')} maxLength={120} />
          </div>

          <div className="mt-3">
            <label className="field-label" htmlFor="ar-body">What they said</label>
            <textarea id="ar-body" rows={3} className="field" value={form.body} onChange={set('body')} maxLength={1500} />
          </div>
        </div>
      )}

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
              className="border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-pop)]"
              style={{ borderRadius: 'var(--r-card)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* A video review can have neither name nor stars. It still
                        needs a heading in this list to be found and acted on. */}
                    <span className={`text-[0.92rem] font-medium ${r.name ? '' : 'text-muted'}`}>
                      {r.name || 'Video review'}
                    </span>
                    {r.designation && <span className="text-[0.76rem] text-muted">{r.designation}</span>}
                    {r.rating > 0 && <Stars n={r.rating} />}
                    {/* Which bucket it sits in is not a decision anyone makes
                        from this screen, so the chip says what it is, not
                        where it is kept. */}
                    {r.video && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bg2 px-2 py-0.5 text-[0.68rem] text-muted">
                        <Play size={9} className="fill-current" /> Video
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
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
                  r.status === 'approved' ? 'bg-brand/10 text-brand'
                  : r.status === 'rejected' ? 'bg-sale/10 text-sale' : 'bg-bg2 text-muted'}`}>
                  {r.status === 'approved' ? 'Live on the site'
                    : r.status === 'rejected' ? 'Rejected' : 'Awaiting review'}
                </span>
              </div>

              {r.title && <p className="mt-3 text-[0.9rem] font-medium">{r.title}</p>}
              {r.body && <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{r.body}</p>}

              {/* The clip, at the shape it was filmed in. The storage backend
                  and the object URL used to be printed beside it: neither is
                  something anyone decides from this screen, and a wrapped
                  90-character URL was the loudest thing on the card. */}
              {r.video?.kind === 'file' ? (
                <video
                  src={r.video.embed}
                  controls
                  playsInline
                  preload="metadata"
                  className="mt-3 h-[230px] w-full bg-black object-cover sm:w-[150px]"
                  style={{ borderRadius: 'var(--r-btn)' }}
                />
              ) : r.video ? (
                /* YouTube and Instagram cannot play inline here, so this is the
                   one case that still needs a way out to the clip. */
                <a href={r.video.url} target="_blank" rel="noreferrer noopener"
                  className="btn btn-sm mt-3 border border-line capitalize">
                  <Play size={12} className="fill-current" /> Watch on {r.video.kind}
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
