import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ticket, Plus, Percent, IndianRupee, ChevronDown } from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Field, Toggle, ConfirmDelete, EmptyState } from './ui.jsx';

const COLLECTIONS = [
  ['wellness-bracelets', 'Wellness Bracelets'],
  ['zodiac-bracelets', 'Zodiac Bracelets'],
  ['rudraksha', 'Rudraksha'],
  ['sukoon-special', 'Sukoon Special'],
];

/* What a shopper actually gets, spelled out. Written from the same fields the
   server reads, so the preview cannot drift from what will be applied. */
function describe(c) {
  const off = c.type === 'flat' ? inr(c.value) : `${c.value}%`;
  const bits = [`${off} off`];
  if (c.type === 'percent' && c.maxDiscount > 0) bits.push(`up to ${inr(c.maxDiscount)}`);
  if (c.minOrder > 0) bits.push(`on orders over ${inr(c.minOrder)}`);
  if (c.firstOrderOnly) bits.push('first order only');
  const cats = Array.isArray(c.categories) ? c.categories : [];
  if (cats.length) {
    bits.push(`on ${cats.map((s) => s.replace(/-/g, ' ')).join(', ')}`);
  }
  return bits.join(' · ');
}

function CouponCard({ c, open, onToggle, onChange, onSave, onDelete, saving, onToggleActive }) {
  const limited = c.usageLimit > 0;
  const exhausted = limited && (c.used || 0) >= c.usageLimit;
  const expired = c.endDate && c.endDate < new Date().toISOString().slice(0, 10);
  const cats = Array.isArray(c.categories) ? c.categories : [];
  const active = c.active !== false;

  const toggleCat = (slug) => {
    const next = cats.includes(slug) ? cats.filter((x) => x !== slug) : [...cats, slug];
    onChange({ ...c, categories: next });
  };

  return (
    <div className="border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
      {/* Compact horizontal summary — expand to edit */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-transform ${
              open ? 'rotate-180 bg-brand-soft text-brand' : 'text-muted'
            }`}
          >
            <ChevronDown size={16} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.95rem] font-medium uppercase tracking-[0.1em]">{c.code || '—'}</span>
              <span className={`badge ${active ? 'badge-ok' : 'badge-neutral'}`}>
                {active ? 'Active' : 'Off'}
              </span>
              {exhausted && <span className="badge badge-sale">Exhausted</span>}
              {expired && <span className="badge badge-sale">Expired</span>}
            </span>
            <span className="mt-0.5 block truncate text-[0.78rem] text-muted">{describe(c)}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={active}
            onChange={(v) => onToggleActive(v)}
            label="Active"
          />
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-sm border border-line"
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line px-4 py-5 sm:px-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Coupon code" className="sm:col-span-2">
                  <input
                    className="field !font-mono !text-[0.95rem] !uppercase !tracking-[0.1em]"
                    value={c.code || ''}
                    onChange={(e) => onChange({ ...c, code: e.target.value.toUpperCase() })}
                    placeholder="SUKOON10"
                  />
                </Field>

                <Field label="Discount type">
                  <select
                    className="field"
                    value={c.type || 'percent'}
                    onChange={(e) => onChange({ ...c, type: e.target.value })}
                  >
                    <option value="percent">Percentage off</option>
                    <option value="flat">Flat amount off</option>
                  </select>
                </Field>

                <Field label={c.type === 'flat' ? 'Amount off (₹)' : 'Percent off (%)'}>
                  <div className="relative">
                    {c.type === 'flat'
                      ? <IndianRupee size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      : <Percent size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
                    <input
                      type="number"
                      min="0"
                      className="field !pl-8"
                      value={c.value ?? 0}
                      onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })}
                    />
                  </div>
                </Field>

                {c.type !== 'flat' && (
                  <Field label="Cap the discount at (₹)" hint="0 = no cap">
                    <input
                      type="number"
                      min="0"
                      className="field"
                      value={c.maxDiscount ?? 0}
                      onChange={(e) => onChange({ ...c, maxDiscount: Number(e.target.value) || 0 })}
                    />
                  </Field>
                )}

                <Field label="Minimum order (₹)" hint="0 = any order">
                  <input
                    type="number"
                    min="0"
                    className="field"
                    value={c.minOrder ?? 0}
                    onChange={(e) => onChange({ ...c, minOrder: Number(e.target.value) || 0 })}
                  />
                </Field>

                <Field label="Total uses allowed" hint="0 = unlimited">
                  <input
                    type="number"
                    min="0"
                    className="field"
                    value={c.usageLimit ?? 0}
                    onChange={(e) => onChange({ ...c, usageLimit: Number(e.target.value) || 0 })}
                  />
                </Field>

                <Field label="Times used" hint="Counted when an order is placed">
                  <input className="field" value={c.used || 0} disabled />
                </Field>

                <Field label="Valid from" hint="Blank = starts now">
                  <input
                    type="date"
                    className="field"
                    value={c.startDate || ''}
                    onChange={(e) => onChange({ ...c, startDate: e.target.value })}
                  />
                </Field>

                <Field label="Valid until" hint="Blank = never expires">
                  <input
                    type="date"
                    className="field"
                    value={c.endDate || ''}
                    onChange={(e) => onChange({ ...c, endDate: e.target.value })}
                  />
                </Field>

                <Field label="Internal note" hint="Not shown to shoppers" className="sm:col-span-2">
                  <input
                    className="field"
                    value={c.label || ''}
                    onChange={(e) => onChange({ ...c, label: e.target.value })}
                    placeholder="10% off your first order"
                  />
                </Field>
              </div>

              <div className="border border-line bg-bg2 p-4" style={{ borderRadius: 'var(--r-btn)' }}>
                <Toggle
                  checked={Boolean(c.firstOrderOnly)}
                  onChange={(v) => onChange({ ...c, firstOrderOnly: v })}
                  label="First order only"
                  hint="Checked against the shopper’s email or phone. Used for SUKOON10."
                />
              </div>

              <Field
                label="Limit to collections"
                hint="None selected = whole cart. Pick Rudraksha for SHRAVAN15."
              >
                <div className="flex flex-wrap gap-2">
                  {COLLECTIONS.map(([slug, label]) => {
                    const on = cats.includes(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => toggleCat(slug)}
                        className={`rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.8rem] transition-colors ${
                          on ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <button onClick={onSave} className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <span className="text-[0.72rem] text-muted">
                  {c.lastUsedAt ? `Last used ${dateLabel(c.lastUsedAt)}` : 'Never used'}
                </span>
                <ConfirmDelete onConfirm={onDelete} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminCoupons() {
  const { toast } = useShop();
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = () => api.coupons().then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    const code = `SUKOON${Math.floor(Math.random() * 90 + 10)}`;
    try {
      const c = await api.createCoupon({ code, active: true });
      setList((l) => [c, ...(l || [])]);
      setOpenId(c.id);
      toast('Coupon added — set the rules and save.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const save = async (c) => {
    setSaving(c.id);
    try {
      const saved = await api.updateCoupon(c.id, c);
      setList((l) => l.map((x) => (x.id === c.id ? saved : x)));
      toast('Saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(''); }
  };

  /* Active on the collapsed row saves immediately — no need to open Edit. */
  const toggleActive = async (c, active) => {
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, active } : x)));
    setSaving(c.id);
    try {
      const saved = await api.updateCoupon(c.id, { active });
      setList((l) => l.map((x) => (x.id === c.id ? { ...x, ...saved } : x)));
      toast(active ? 'Coupon activated.' : 'Coupon turned off.', 'success');
    } catch (e) {
      setList((l) => l.map((x) => (x.id === c.id ? { ...x, active: c.active } : x)));
      toast(e.message, 'error');
    } finally {
      setSaving('');
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteCoupon(id);
      setList((l) => l.filter((c) => c.id !== id));
      if (openId === id) setOpenId(null);
      toast('Deleted.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!list) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-bg2" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-[0.86rem] leading-relaxed text-muted">
          Each row is a code. Toggle Active on the row, or expand Edit to change the rules.
          Discounts are calculated on the server.
        </p>
        <button onClick={add} className="btn btn-primary shrink-0">
          <Plus size={15} /> New coupon
        </button>
      </div>

      {!list.length ? (
        <EmptyState
          icon={Ticket}
          title="No coupons yet"
          text="Create one and shoppers can use it at checkout straight away."
          action={(
            <button onClick={add} className="btn btn-primary">
              <Plus size={15} /> New coupon
            </button>
          )}
        />
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CouponCard
                c={c}
                open={openId === c.id}
                onToggle={() => setOpenId((id) => (id === c.id ? null : c.id))}
                saving={saving === c.id}
                onChange={(next) => setList((l) => l.map((x) => (x.id === c.id ? next : x)))}
                onSave={() => save(list.find((x) => x.id === c.id))}
                onToggleActive={(v) => toggleActive(c, v)}
                onDelete={() => remove(c.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
