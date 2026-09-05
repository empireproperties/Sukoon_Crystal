import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Eye, ExternalLink, Save, RotateCcw, Upload } from 'lucide-react';

import { api } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { PALETTES, getPalette, normalisePalette } from '../theme/designs.js';
import { Field, SavedTick } from './ui.jsx';
import { markUrl } from '../components/Logo.jsx';
import { CARD_FIELDS, CARD_DEFAULTS } from '../components/ProductCard.jsx';
import { HERO_STYLES } from '../components/HeroCarousel.jsx';

/* One colourway. The strip shows the tokens that actually change what the
   storefront looks like, so the choice can be made without opening the site. */
function Swatch({ p, live, current, preview, publish, saving }) {
  const [bg, surface, ink, accent] = p.swatch;
  const isLive = live === p.id;
  const isPreviewing = current === p.id && !isLive;

  return (
    <article
      className={`overflow-hidden border-2 bg-surface transition-colors ${
        isLive ? 'border-brand' : isPreviewing ? 'border-accent' : 'border-line'
      }`}
      style={{ borderRadius: 'var(--r-card)' }}
    >
      <button onClick={() => preview('gallery', p.id)} className="block w-full text-left" aria-label={`Preview ${p.name}`}>
        <div className="flex h-24" style={{ background: bg }}>
          <div className="flex flex-1 flex-col justify-center pl-5">
            <span style={{ color: ink, fontSize: 19, fontFamily: "'Marcellus', Georgia, serif", lineHeight: 1 }}>Sukoon</span>
            <span style={{ color: accent, fontSize: 8, letterSpacing: '0.22em', marginTop: 6 }}>CRYSTAL SOLUTIONS</span>
          </div>
          <div className="flex w-24 shrink-0 flex-col">
            <span className="flex-1" style={{ background: accent }} />
            <span className="flex-1" style={{ background: ink }} />
            <span className="flex-1" style={{ background: surface }} />
          </div>
        </div>
      </button>

      <div className="border-t border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.9rem] font-medium">{p.name}</p>
          {isLive && <span className="badge badge-ok shrink-0">Live</span>}
          {isPreviewing && <span className="badge shrink-0 text-accent">Previewing</span>}
        </div>
        <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">{p.note}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => preview('gallery', p.id)} className="btn btn-outline btn-sm flex-1">
            <Eye size={12} /> Preview
          </button>
          <button onClick={() => publish('gallery', p.id)} disabled={saving || isLive}
            className="btn btn-primary btn-sm flex-1 disabled:opacity-40">
            {isLive ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Appearance() {
  const { settings, applyTheme, refreshSettings, palette, toast } = useShop();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => { if (settings && !form) setForm({ ...settings }); }, [settings, form]);

  const livePalette = normalisePalette(settings?.palette);
  const isPreviewing = palette !== livePalette;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const preview = (d, p) => applyTheme(d, p);

  const publish = async (d, p) => {
    setSaving(true);
    try {
      await api.saveSettings({ design: 'gallery', palette: p });
      await refreshSettings();
      toast('Published — the live storefront now uses this colourway.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const logoRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const founderRef = useRef(null);
  const [uploadingFounder, setUploadingFounder] = useState(false);

  const saveDetails = async () => {
    setSaving(true);
    try {
      await api.saveSettings(form);
      await refreshSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const paletteName = (id) => getPalette(id)?.name;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ intro */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-xl font-medium">Colour theme</h2>
          <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">
            Eight colourways — five light, three dark.
            <strong className="text-ink"> Preview</strong> changes only what you see on this browser,
            so you can try them safely; <strong className="text-ink">Publish</strong> is what changes
            the live site for visitors.
          </p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-muted">
            The layout and typography are the same in all of them — only the colour changes.
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
          <ExternalLink size={13} /> Open live site
        </a>
      </div>

      {/* -------------------------------------------------- preview notice */}
      {isPreviewing && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--r-card)] border border-accent/40 bg-accent/8 px-5 py-3.5">
          <Eye size={15} strokeWidth={1.8} className="text-accent" />
          <p className="flex-1 text-[0.86rem]">
            Previewing <strong>{paletteName(palette)}</strong>. Visitors still
            see <strong>{paletteName(livePalette)}</strong>.
          </p>
          <button onClick={() => preview('gallery', livePalette)} className="btn btn-outline btn-sm">
            <RotateCcw size={13} /> Back to live
          </button>
          <button onClick={() => publish('gallery', palette)} disabled={saving} className="btn btn-primary btn-sm">
            Publish this
          </button>
        </div>
      )}

      {/* ------------------------------------------------------- colourways */}
      <div>
        <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Light</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PALETTES.filter((x) => x.tone === 'light').map((x) => (
            <Swatch key={x.id} p={x} live={livePalette} current={palette} preview={preview} publish={publish} saving={saving} />
          ))}
        </div>

        <h3 className="mt-8 text-[0.7rem] uppercase tracking-[0.2em] text-muted">Dark</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PALETTES.filter((x) => x.tone === 'dark').map((x) => (
            <Swatch key={x.id} p={x} live={livePalette} current={palette} preview={preview} publish={publish} saving={saving} />
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- store details */}
      {form && (
        <section className="rounded-[var(--r-card)] border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Store details</h2>
              <p className="mt-1 text-[0.82rem] text-muted">
                These appear in the header strip, the footer and the contact page.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SavedTick show={saved} />
              <button onClick={saveDetails} disabled={saving} className="btn btn-primary btn-sm">
                <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Store name"><input value={form.siteName || ''} onChange={set('siteName')} className="field" /></Field>
            <Field label="Tagline"><input value={form.tagline || ''} onChange={set('tagline')} className="field" /></Field>
            <Field label="Phone number"><input value={form.phone || ''} onChange={set('phone')} className="field" /></Field>
            <Field label="Email address"><input value={form.email || ''} onChange={set('email')} className="field" /></Field>
            <Field label="Studio address" className="sm:col-span-2"><input value={form.address || ''} onChange={set('address')} className="field" /></Field>
            <Field label="Instagram URL" className="sm:col-span-2"><input value={form.instagram || ''} onChange={set('instagram')} className="field" /></Field>
            <Field label="Facebook URL" className="sm:col-span-2"><input value={form.facebook || ''} onChange={set('facebook')} className="field" /></Field>

            {/* Shown in the header, the footer and the mobile menu. Falls back
                to the bundled mark when cleared, so it is never missing. */}
            <Field
              label="Logo"
              hint="Square, ideally on a transparent background. Shown at 40px in the header."
              className="sm:col-span-2"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-bg2">
                  <img src={form.logo || markUrl(64)} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 space-y-2">
                  <input value={form.logo || ''} onChange={set('logo')} className="field" placeholder="Leave blank to use the bundled mark" />
                  <button onClick={() => logoRef.current?.click()} className="btn btn-sm border border-line" disabled={uploadingLogo}>
                    <Upload size={13} /> {uploadingLogo ? 'Uploading…' : 'Upload a logo'}
                  </button>
                  <input
                    ref={logoRef} type="file" accept="image/*" hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingLogo(true);
                      try {
                        const { url } = await api.upload(file);
                        setForm((f) => ({ ...f, logo: url }));
                        toast('Logo uploaded. Remember to save.', 'success');
                      } catch (err) { toast(err.message, 'error'); }
                      finally { setUploadingLogo(false); e.target.value = ''; }
                    }}
                  />
                </div>
              </div>
            </Field>

            {/* Used by the Our Story block on the homepage and the About page.
                Both show a "no portrait yet" placeholder until this is set. */}
            <Field
              label="Portrait of Swati"
              hint="Shown in Our Story and on the About page. Portrait orientation, at least 800px wide."
              className="sm:col-span-2"
            >
              <div className="flex items-start gap-3">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded bg-bg2">
                  {form.founderImage
                    ? <img src={form.founderImage} alt="" className="h-full w-full object-cover" />
                    : <div className="grid h-full w-full place-items-center text-[0.58rem] text-muted">none</div>}
                </div>
                <div className="flex-1 space-y-2">
                  <input value={form.founderImage || ''} onChange={set('founderImage')} className="field" placeholder="https://…" />
                  <button
                    onClick={() => founderRef.current?.click()}
                    className="btn btn-sm border border-line"
                    disabled={uploadingFounder}
                  >
                    <Upload size={13} /> {uploadingFounder ? 'Uploading…' : 'Upload a photo'}
                  </button>
                  <input
                    ref={founderRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingFounder(true);
                      try {
                        const { url } = await api.upload(file);
                        setForm((f) => ({ ...f, founderImage: url }));
                        toast('Photo uploaded. Remember to save.', 'success');
                      } catch (err) {
                        toast(err.message, 'error');
                      } finally {
                        setUploadingFounder(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            </Field>
            {/* Homepage banner layout. Preview each on the live site with
                ?hero=split|frame|strip before committing to one. */}
            <div className="sm:col-span-2">
              <p className="field-label">Homepage banner layout</p>
              <p className="-mt-1 mb-3 text-[0.78rem] text-muted">
                How the carousel is arranged. Preview any of them on the live site by adding
                <code className="mx-1 rounded bg-bg2 px-1">?hero=frame</code> to the address.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {HERO_STYLES.map((h) => {
                  const on = (form.heroStyle || 'split') === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, heroStyle: h.id }))}
                      className={`border p-3 text-left transition ${on ? 'border-brand bg-brand-soft' : 'border-line hover:bg-bg2'}`}
                      style={{ borderRadius: 'var(--r-btn)' }}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-brand bg-brand text-white' : 'border-line'}`}>
                          {on && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span className="text-[0.88rem] font-medium">{h.name}</span>
                      </span>
                      <span className="mt-1.5 block text-[0.74rem] leading-snug text-muted">{h.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What a product tile is allowed to show. Kept beside the store
                details rather than on its own screen because it is a handful of
                switches, not a workflow. */}
            <div className="sm:col-span-2">
              <p className="field-label">Product card</p>
              <p className="-mt-1 mb-3 text-[0.78rem] text-muted">
                Choose what appears on every product tile across the shop and homepage.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CARD_FIELDS.map(([key, label, hint]) => {
                  const on = { ...CARD_DEFAULTS, ...(form.card || {}) }[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        card: { ...CARD_DEFAULTS, ...(f.card || {}), [key]: !on },
                      }))}
                      className={`flex items-start gap-3 border p-3 text-left transition ${
                        on ? 'border-brand bg-brand-soft' : 'border-line hover:bg-bg2'
                      }`}
                      style={{ borderRadius: 'var(--r-btn)' }}
                    >
                      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        on ? 'border-brand bg-brand text-white' : 'border-line'
                      }`}>
                        {on && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.85rem] font-medium">{label}</span>
                        <span className="mt-0.5 block text-[0.74rem] leading-snug text-muted">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field
              label="Header announcement"
              hint="Shown in the thin strip above the navigation when no top banner campaign is running."
              className="sm:col-span-2"
            >
              <input value={form.announcement || ''} onChange={set('announcement')} className="field" />
            </Field>
          </div>
        </section>
      )}
    </div>
  );
}
