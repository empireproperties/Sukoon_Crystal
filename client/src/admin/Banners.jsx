import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Megaphone, Upload, Eye, EyeOff, ImageOff, ArrowRight, Tag } from 'lucide-react';

import { api, dateLabel } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import { BANNER_PALETTES } from '../components/Banners.jsx';
import { SlideOver, ConfirmDelete, Toggle, Field, EmptyState } from './ui.jsx';

const PLACEMENTS = [
  { id: 'top', label: 'Announcement strip', hint: 'Thin bar above the navigation, on every page' },
  { id: 'hero', label: 'Campaign block', hint: 'Large panel in the middle of the home page' },
];

const LINKS = [
  ['/shop', 'All products'],
  ['/shop/wellness-bracelets', 'Wellness Bracelets'],
  ['/shop/zodiac-bracelets', 'Zodiac Bracelets'],
  ['/shop/rudraksha', 'Rudraksha'],
  ['/shop/sukoon-special', 'Sukoon Special'],
  ['/book', 'Book a consultation'],
  ['/calendar', 'Celestial calendar'],
];

const PRESETS = [
  { title: 'Diwali Muhurat Sale', subtitle: 'The wealth window', message: 'Up to 30% off money trees, pyrite and citrine', code: 'DIWALI30', palette: 'saffron', cta: 'Shop the sale', link: '/shop' },
  { title: 'Navratri Nine Nights', subtitle: 'Nine goddesses, nine stones', message: 'A new stone unlocked every night of the festival', code: 'NAVRATRI9', palette: 'maroon', cta: 'See tonight’s stone', link: '/calendar' },
  { title: 'Full Moon Charging', subtitle: 'Tonight only', message: 'Free selenite charging plate on every order above ₹1,499', code: 'FULLMOON', palette: 'indigo', cta: 'Shop now', link: '/shop/sukoon-special' },
  { title: 'Shravan Special', subtitle: 'Energised Rudraksha', message: 'Flat 15% off all Rudraksha through the holy month', code: 'SHRAVAN15', palette: 'green', cta: 'Shop Rudraksha', link: '/shop/rudraksha' },
];

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

const blank = () => ({
  title: '', subtitle: '', message: '', code: '', cta: 'Shop now', link: '/shop',
  palette: 'green', placement: 'top', active: false, image: '',
  startDate: today(), endDate: plus(14),
});

/* ---------------------------------------------------------- live preview */
function Preview({ b }) {
  const p = BANNER_PALETTES[b.palette] || BANNER_PALETTES.green;

  if (b.placement === 'top') {
    return (
      <div className="overflow-hidden" style={{ background: p.bg, color: p.fg, borderRadius: 'var(--r-card)' }}>
        <div className="flex flex-wrap items-center justify-center gap-2.5 px-5 py-2.5 text-center text-[0.76rem]">
          <span className="font-medium">{b.title || 'Campaign title'}</span>
          <span className="opacity-40">·</span>
          <span className="opacity-95">{b.message || 'Your offer message appears here'}</span>
          {b.code && (
            <span className="rounded-[var(--r-btn)] border px-2 py-0.5 text-[0.7rem] font-medium" style={{ borderColor: `${p.accent}80`, color: p.accent }}>
              {b.code}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ background: p.bg, color: p.fg, borderRadius: 'var(--r-card)' }}>
      {b.image && <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="relative grid items-center gap-5 p-7 lg:grid-cols-[1.5fr_auto]">
        <div>
          <p className="text-[0.66rem] font-medium uppercase tracking-[0.2em]" style={{ color: p.accent }}>
            {b.subtitle || 'Subtitle'}
          </p>
          <p className="mt-2 font-display text-2xl leading-tight">{b.title || 'Campaign title'}</p>
          <p className="mt-2 max-w-md text-[0.85rem] opacity-85">{b.message || 'Your offer message appears here'}</p>
          {b.code && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.74rem]" style={{ borderColor: `${p.accent}66` }}>
              <Tag size={12} strokeWidth={1.8} style={{ color: p.accent }} /> Use code <strong>{b.code}</strong>
            </p>
          )}
        </div>
        <span className="btn justify-self-start lg:justify-self-end" style={{ background: p.accent, color: p.bg, border: `1px solid ${p.accent}` }}>
          {b.cta || 'Shop now'} <ArrowRight size={14} strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

export default function AdminBanners() {
  const { toast, refreshSettings } = useShop();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: banners = [], loading, reload } = useAsync(() => api.banners(true), []);

  const patch = (k, v) => setEditing((e) => ({ ...e, [k]: v }));
  const refreshAll = async () => { reload(); await refreshSettings(); };

  const save = async () => {
    if (!editing.title?.trim()) return toast('Give the campaign a title.', 'warn');
    setSaving(true);
    try {
      if (editing.id) await api.updateBanner(editing.id, editing);
      else await api.createBanner(editing);
      toast(editing.active ? 'Saved and live on the site.' : 'Saved as a draft.', 'success');
      setEditing(null);
      refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b) => {
    await api.updateBanner(b.id, { active: !b.active });
    toast(b.active ? 'Banner taken down.' : 'Banner is now live on the site.', 'success');
    refreshAll();
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      patch('image', url);
      toast('Artwork uploaded.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const liveNow = (b) => b.active && b.startDate <= today() && b.endDate >= today();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-[0.88rem] leading-relaxed text-muted">
          Festive and offer banners for the live store. Switch one on and it appears on the site
          immediately — no deploy, no developer. Each one runs only between its start and end dates.
        </p>
        <button onClick={() => setEditing(blank())} className="btn btn-primary btn-sm">
          <Plus size={14} /> New campaign
        </button>
      </div>

      <div>
        <p className="field-label">Start from a festival template</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.title}
              onClick={() => setEditing({ ...blank(), ...p, placement: 'hero' })}
              className="flex items-center gap-2.5 rounded-[var(--r-btn)] border border-line bg-surface px-3.5 py-2 text-[0.8rem] transition-colors hover:border-brand hover:text-brand"
            >
              <span className="h-3 w-3 rounded-full" style={{ background: BANNER_PALETTES[p.palette].bg }} />
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-36" style={{ borderRadius: 'var(--r-card)' }} />)}
        </div>
      ) : !banners.length ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          text="Create one for the next festival or offer."
          action={<button onClick={() => setEditing(blank())} className="btn btn-primary">New campaign</button>}
        />
      ) : (
        <div className="space-y-4">
          {banners.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-line bg-surface p-5"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className={`badge ${liveNow(b) ? 'badge-ok' : b.active ? 'badge-brand' : 'badge-neutral'}`}>
                  {liveNow(b) ? 'Live now' : b.active ? 'Scheduled' : 'Draft'}
                </span>
                <span className="badge badge-neutral">{PLACEMENTS.find((p) => p.id === b.placement)?.label}</span>
                <span className="text-[0.76rem] text-muted">
                  {dateLabel(b.startDate, { day: 'numeric', month: 'short' })} to {dateLabel(b.endDate, { day: 'numeric', month: 'short' })}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`flex items-center gap-2 rounded-[var(--r-btn)] px-3 py-2 text-[0.78rem] transition-colors ${
                      b.active ? 'text-brand hover:bg-brand-soft' : 'text-muted hover:bg-bg2 hover:text-ink'
                    }`}
                  >
                    {b.active ? <><Eye size={14} /> Live</> : <><EyeOff size={14} /> Off</>}
                  </button>
                  <button onClick={() => setEditing({ ...b })} className="rounded-[var(--r-btn)] px-3 py-2 text-[0.78rem] text-muted transition-colors hover:bg-bg2 hover:text-ink">
                    Edit
                  </button>
                  <ConfirmDelete onConfirm={async () => { await api.deleteBanner(b.id); refreshAll(); toast('Campaign deleted.', 'success'); }} />
                </div>
              </div>
              <Preview b={b} />
            </motion.div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ editor */}
      <SlideOver
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit campaign' : 'New campaign'}
        subtitle="Changes go live the moment you save"
        width="max-w-3xl"
        footer={
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : editing?.active ? 'Save and publish' : 'Save as draft'}
            </button>
            {editing?.id && (
              <ConfirmDelete onConfirm={async () => { await api.deleteBanner(editing.id); setEditing(null); refreshAll(); }} />
            )}
          </div>
        }
      >
        {editing && (
          <div className="space-y-6">
            <div>
              <p className="field-label">Live preview</p>
              <Preview b={editing} />
            </div>

            <Field label="Where should it appear?">
              <div className="grid gap-3 sm:grid-cols-2">
                {PLACEMENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => patch('placement', p.id)}
                    className={`border p-4 text-left transition-colors ${
                      editing.placement === p.id ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand'
                    }`}
                    style={{ borderRadius: 'var(--r-card)' }}
                  >
                    <p className="text-[0.9rem] font-medium">{p.label}</p>
                    <p className="mt-1 text-[0.76rem] text-muted">{p.hint}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Colour">
              <div className="flex flex-wrap gap-2.5">
                {Object.entries(BANNER_PALETTES).map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => patch('palette', id)}
                    className={`flex items-center gap-2.5 rounded-[var(--r-btn)] border px-3.5 py-2.5 text-[0.8rem] transition-colors ${
                      editing.palette === id ? 'border-brand text-brand' : 'border-line hover:border-brand'
                    }`}
                  >
                    <span className="h-5 w-8 rounded-[3px]" style={{ background: p.bg }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input value={editing.title} onChange={(e) => patch('title', e.target.value)} className="field" placeholder="Diwali Muhurat Sale" />
              </Field>
              <Field label="Subtitle" hint="Only shown on the campaign block">
                <input value={editing.subtitle} onChange={(e) => patch('subtitle', e.target.value)} className="field" placeholder="The wealth window" />
              </Field>
              <Field label="Message" className="sm:col-span-2">
                <input value={editing.message} onChange={(e) => patch('message', e.target.value)} className="field" placeholder="Up to 30% off money trees, pyrite and citrine" />
              </Field>
              <Field label="Coupon code" hint="Leave blank for no code">
                <input value={editing.code} onChange={(e) => patch('code', e.target.value.toUpperCase())} className="field uppercase" placeholder="DIWALI30" />
              </Field>
              <Field label="Button label">
                <input value={editing.cta} onChange={(e) => patch('cta', e.target.value)} className="field" placeholder="Shop the sale" />
              </Field>
              <Field label="Button links to" className="sm:col-span-2">
                <select value={editing.link} onChange={(e) => patch('link', e.target.value)} className="field">
                  {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Starts on">
                <input type="date" value={editing.startDate} onChange={(e) => patch('startDate', e.target.value)} className="field" />
              </Field>
              <Field label="Ends on">
                <input type="date" value={editing.endDate} onChange={(e) => patch('endDate', e.target.value)} className="field" />
              </Field>
            </div>

            {editing.placement === 'hero' && (
              <Field label="Background artwork" hint="Optional. Sits behind the colour at 25% opacity.">
                <div className="flex items-center gap-4">
                  <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 border border-dashed border-line px-4 py-5 text-[0.8rem] text-muted transition-colors hover:border-brand hover:text-brand ${uploading ? 'opacity-50' : ''}`} style={{ borderRadius: 'var(--r-card)' }}>
                    <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload festive artwork'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                  </label>
                  {editing.image && (
                    <div className="group relative h-16 w-24 overflow-hidden border border-line" style={{ borderRadius: 'var(--r-btn)' }}>
                      <img src={editing.image} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => patch('image', '')} className="absolute inset-0 grid place-items-center bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remove artwork">
                        <ImageOff size={15} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>
              </Field>
            )}

            <div className="border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <Toggle
                checked={!!editing.active}
                onChange={(v) => patch('active', v)}
                label="Publish to the live site"
                hint="It only shows between the start and end dates above"
              />
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
