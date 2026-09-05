import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, ExternalLink, AlertTriangle, Check } from 'lucide-react';

import { api } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Field, EmptyState } from './ui.jsx';

/* Sections are {heading, body[], list[]}. The editor keeps that shape rather
   than flattening to a textarea, so the published page keeps its structure. */
const blank = () => ({ heading: '', body: [''], list: null });

function SectionEditor({ section, onChange, onRemove }) {
  const setBody = (i, v) => onChange({ ...section, body: section.body.map((p, j) => (j === i ? v : p)) });

  return (
    <div className="border border-line bg-bg2 p-4" style={{ borderRadius: 'var(--r-btn)' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <Field label="Heading" hint="Leave blank for an opening paragraph with no title">
            <input className="field" value={section.heading || ''} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>

          {section.body.map((p, i) => (
            <div key={i} className="flex gap-2">
              <textarea rows={3} className="field flex-1" value={p} onChange={(e) => setBody(i, e.target.value)} />
              {section.body.length > 1 && (
                <button onClick={() => onChange({ ...section, body: section.body.filter((_, j) => j !== i) })}
                  className="shrink-0 self-start rounded p-2 text-muted hover:bg-surface hover:text-sale" aria-label="Remove paragraph">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => onChange({ ...section, body: [...section.body, ''] })}
            className="text-[0.8rem] text-accent underline underline-offset-2">+ paragraph</button>

          {section.list && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="field-label">Bulleted list</p>
              {section.list.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field flex-1" value={item}
                    onChange={(e) => onChange({ ...section, list: section.list.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button onClick={() => onChange({ ...section, list: section.list.filter((_, j) => j !== i) })}
                    className="shrink-0 rounded p-2 text-muted hover:bg-surface hover:text-sale" aria-label="Remove item">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => onChange({ ...section, list: [...section.list, ''] })}
                className="text-[0.8rem] text-accent underline underline-offset-2">+ item</button>
            </div>
          )}

          {!section.list && (
            <button onClick={() => onChange({ ...section, list: [''] })}
              className="text-[0.8rem] text-accent underline underline-offset-2">+ add a bulleted list</button>
          )}
        </div>

        <button onClick={onRemove} className="shrink-0 rounded p-2 text-muted hover:bg-surface hover:text-sale" aria-label="Remove section">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AdminPages() {
  const { toast } = useShop();
  const [pages, setPages] = useState(null);
  const [handle, setHandle] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.pages().then((p) => { setPages(p); setHandle(p[0]?.handle || null); }).catch((e) => toast(e.message, 'error')); }, [toast]);
  useEffect(() => { if (handle) api.page(handle).then(setDraft).catch(() => setDraft(null)); }, [handle]);

  const save = async () => {
    setSaving(true);
    try {
      /* Saving is the owner signing the copy off, so the "draft" flag clears. */
      const saved = await api.savePage(handle, { ...draft, reviewed: true });
      setDraft(saved);
      setPages((p) => p.map((x) => (x.handle === handle ? { ...x, ...saved } : x)));
      toast('Page saved and marked as reviewed.', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (!pages) return <div className="h-64 animate-pulse rounded bg-bg2" />;
  if (!pages.length) return <EmptyState icon={FileText} title="No pages" text="Policy pages are seeded when the server starts." />;

  const unreviewed = pages.filter((p) => p.reviewed === false);

  return (
    <div>
      {unreviewed.length > 0 && (
        <div className="mb-6 flex items-start gap-2.5 border border-accent/30 bg-accent/5 p-4" style={{ borderRadius: 'var(--r-btn)' }}>
          <AlertTriangle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[0.84rem] leading-relaxed text-muted">
            <strong className="text-ink">{unreviewed.length} page(s) are drafts.</strong>{' '}
            They were written as sensible starting points, not legal advice — read
            {' '}{unreviewed.map((p) => p.title).join(', ')} and edit before the store opens.
            Saving a page marks it reviewed.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {pages.map((p) => (
            <button key={p.handle} onClick={() => setHandle(p.handle)}
              className={`flex w-full items-center justify-between gap-2 rounded-[var(--r-btn)] px-3 py-2.5 text-left text-[0.86rem] transition ${
                handle === p.handle ? 'bg-bg2 text-ink' : 'text-muted hover:bg-bg2 hover:text-ink'}`}>
              <span className="truncate">{p.title}</span>
              {p.reviewed === false
                ? <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.62rem] text-accent">draft</span>
                : <Check size={12} className="shrink-0 text-brand" />}
            </button>
          ))}
        </nav>

        <div>
          {!draft ? <div className="h-64 animate-pulse rounded bg-bg2" /> : (
            <motion.div key={handle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">{draft.title}</h2>
                  <a href={`/${draft.handle}`} target="_blank" rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1.5 text-[0.78rem] text-muted hover:text-brand">
                    /{draft.handle} <ExternalLink size={11} />
                  </a>
                </div>
                <button onClick={save} className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save page'}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <input className="field" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </Field>
                <Field label="Last updated" hint="Shown under the title">
                  <input className="field" value={draft.updated || ''} placeholder="September 2025"
                    onChange={(e) => setDraft({ ...draft, updated: e.target.value })} />
                </Field>
              </div>

              <div className="mt-5 space-y-3">
                {(draft.sections || []).map((s, i) => (
                  <SectionEditor
                    key={i}
                    section={{ heading: s.heading || '', body: s.body || [''], list: s.list || null }}
                    onChange={(next) => setDraft({ ...draft, sections: draft.sections.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => setDraft({ ...draft, sections: draft.sections.filter((_, j) => j !== i) })}
                  />
                ))}
              </div>

              <button onClick={() => setDraft({ ...draft, sections: [...(draft.sections || []), blank()] })}
                className="btn mt-4 border border-line"><Plus size={14} /> Add section</button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
