import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Images, Plus, Upload, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

import { api } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { EmptyState, Field, Toggle, ConfirmDelete } from './ui.jsx';

const ALIGNS = [['left', 'Left'], ['centre', 'Centre'], ['right', 'Right']];
const TONES = [['dark', 'Light text on dark'], ['light', 'Dark text on light']];

function SlideEditor({ slide, onChange, onSave, onDelete, onMove, first, last, saving }) {
  const fileRef = useRef(null);
  const mobileRef = useRef(null);
  const { toast } = useShop();
  const [uploading, setUploading] = useState('');

  const pick = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const { url } = await api.upload(file);
      onChange({ ...slide, [field]: url });
      toast('Image uploaded to Cloudinary.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading('');
      e.target.value = '';
    }
  };

  return (
    <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => onMove(-1)} disabled={first} aria-label="Move up"
              className="rounded p-1 text-muted transition hover:bg-bg2 disabled:opacity-25"><ArrowUp size={13} /></button>
            <button onClick={() => onMove(1)} disabled={last} aria-label="Move down"
              className="rounded p-1 text-muted transition hover:bg-bg2 disabled:opacity-25"><ArrowDown size={13} /></button>
          </div>
          <div className="h-12 w-28 shrink-0 overflow-hidden rounded bg-bg2">
            {slide.image
              ? <img src={slide.image} alt="" className="h-full w-full object-cover" />
              : <div className="grid h-full w-full place-items-center text-[0.62rem] text-muted">No image</div>}
          </div>
          <div>
            <p className="text-[0.9rem] font-medium">{slide.title || 'Banner only'}</p>
            <p className="text-[0.74rem] text-muted">{slide.active ? 'Live' : 'Hidden'}</p>
          </div>
        </div>
        <Toggle checked={Boolean(slide.active)} onChange={(v) => onChange({ ...slide, active: v })} label="Show on the homepage" />
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <Field label="Eyebrow" hint="Small line above the headline">
          <input className="field" value={slide.eyebrow || ''} onChange={(e) => onChange({ ...slide, eyebrow: e.target.value })} />
        </Field>
        <Field label="Button label">
          <input className="field" value={slide.cta || ''} onChange={(e) => onChange({ ...slide, cta: e.target.value })} />
        </Field>
        <Field label="Headline" hint="A line break here becomes a line break on the page" className="sm:col-span-2">
          <textarea rows={2} className="field" value={slide.title || ''} onChange={(e) => onChange({ ...slide, title: e.target.value })} />
        </Field>
        <Field label="Subtitle" className="sm:col-span-2">
          <textarea rows={2} className="field" value={slide.subtitle || ''} onChange={(e) => onChange({ ...slide, subtitle: e.target.value })} />
        </Field>
        <Field label="Button link">
          <input className="field" value={slide.link || ''} placeholder="/shop/rudraksha"
            onChange={(e) => onChange({ ...slide, link: e.target.value })} />
        </Field>
        <Field label="Text position">
          <select className="field" value={slide.align || 'left'} onChange={(e) => onChange({ ...slide, align: e.target.value })}>
            {ALIGNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Text colour" hint="Pick whichever reads against your photograph">
          <select className="field" value={slide.tone || 'dark'} onChange={(e) => onChange({ ...slide, tone: e.target.value })}>
            {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field
          label="Banner artwork — desktop"
          hint="Wide banner, 21:9. 2200 × 943px is ideal."
          className="sm:col-span-2"
        >
          <div className="flex gap-2">
            <input className="field flex-1" value={slide.image || ''} placeholder="https://…"
              onChange={(e) => onChange({ ...slide, image: e.target.value })} />
            <button onClick={() => fileRef.current?.click()} className="btn shrink-0 border border-line" disabled={uploading === 'image'}>
              {uploading === 'image' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e, 'image')} />
          </div>
        </Field>

        {/* A 21:9 banner shown at phone width is a 60px sliver, so a separate
            upright crop is worth having. Falls back to the desktop art. */}
        <Field
          label="Banner artwork — mobile"
          hint="Optional. Upright, 4:5. 900 × 1125px. Falls back to the desktop banner."
          className="sm:col-span-2"
        >
          <div className="flex gap-2">
            <input className="field flex-1" value={slide.mobileImage || ''} placeholder="https://…"
              onChange={(e) => onChange({ ...slide, mobileImage: e.target.value })} />
            <button onClick={() => mobileRef.current?.click()} className="btn shrink-0 border border-line" disabled={uploading === 'mobileImage'}>
              {uploading === 'mobileImage' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </button>
            <input ref={mobileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e, 'mobileImage')} />
          </div>
        </Field>

        {/* Campaign windows: a slide can be scheduled to appear and retire on
            its own, which is how a festival banner disappears without anyone
            remembering to take it down. */}
        <Field label="Show from" hint="Leave blank to start immediately">
          <input type="date" className="field" value={slide.startDate || ''} onChange={(e) => onChange({ ...slide, startDate: e.target.value })} />
        </Field>
        <Field label="Show until" hint="Leave blank to run indefinitely">
          <input type="date" className="field" value={slide.endDate || ''} onChange={(e) => onChange({ ...slide, endDate: e.target.value })} />
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <button onClick={onSave} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save slide'}
        </button>
        <ConfirmDelete onConfirm={onDelete} />
      </div>
    </div>
  );
}

export default function AdminSlides() {
  const { toast } = useShop();
  const [slides, setSlides] = useState(null);
  const [saving, setSaving] = useState('');

  const load = () => api.slides(true).then((s) => setSlides([...s].sort((a, b) => (a.order || 0) - (b.order || 0))))
    .catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    try {
      const s = await api.createSlide({});
      setSlides((l) => [...(l || []), s]);
    } catch (e) { toast(e.message, 'error'); }
  };

  const change = (id, next) => setSlides((l) => l.map((s) => (s.id === id ? next : s)));

  const persist = async (slide) => {
    setSaving(slide.id);
    try {
      await api.updateSlide(slide.id, slide);
      toast('Slide saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(''); }
  };

  const remove = async (id) => {
    try { await api.deleteSlide(id); setSlides((l) => l.filter((s) => s.id !== id)); toast('Slide deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  /* Order is a stored field, so a reorder writes every affected slide. */
  const move = async (id, dir) => {
    const i = slides.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    const renumbered = next.map((s, k) => ({ ...s, order: k }));
    setSlides(renumbered);
    await Promise.all(renumbered.map((s) => api.updateSlide(s.id, { order: s.order }))).catch((e) => toast(e.message, 'error'));
  };

  if (!slides) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded bg-bg2" />)}</div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-[0.86rem] leading-relaxed text-muted">
          Slides shown in the homepage carousel, top to bottom. When none are live —
          because you hid them or their dates passed — the homepage falls back to a
          built-in hero, so it is never blank.
        </p>
        <button onClick={add} className="btn btn-primary shrink-0"><Plus size={15} /> Add slide</button>
      </div>

      {!slides.length ? (
        <EmptyState icon={Images} title="No slides yet"
          text="Add one to take over the top of the homepage."
          action={<button onClick={add} className="btn btn-primary"><Plus size={15} /> Add slide</button>} />
      ) : (
        <div className="space-y-4">
          {slides.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <SlideEditor
                slide={s}
                first={i === 0}
                last={i === slides.length - 1}
                saving={saving === s.id}
                onChange={(next) => change(s.id, next)}
                onSave={() => persist(s)}
                onDelete={() => remove(s.id)}
                onMove={(dir) => move(s.id, dir)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
