import { useEffect, useState, Fragment } from 'react';
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

function discountLabel(c) {
  return c.type === 'flat' ? inr(c.value) : `${c.value}%`;
}

function rulesLabel(c) {
  const bits = [];
  if (c.firstOrderOnly) bits.push('First order');
  const cats = Array.isArray(c.categories) ? c.categories : [];
  if (cats.length) bits.push(cats.map((s) => s.replace(/-/g, ' ')).join(', '));
  else bits.push('Whole cart');
  if (c.minOrder > 0) bits.push(`min ${inr(c.minOrder)}`);
  return bits.join(' · ');
}

/** Small switch for table cells — no label text crowding the row. */
function RowSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <motion.span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
        animate={{ left: checked ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

function CouponEditor({ c, onChange, onSave, onDelete, saving }) {
  const cats = Array.isArray(c.categories) ? c.categories : [];

  const toggleCat = (slug) => {
    const next = cats.includes(slug) ? cats.filter((x) => x !== slug) : [...cats, slug];
    onChange({ ...c, categories: next });
  };

  return (
    <div className="space-y-4 bg-bg2/60 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Coupon code" className="sm:col-span-2 lg:col-span-1">
          <input
            className="field !font-mono !uppercase !tracking-[0.1em]"
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
          <Field label="Cap at (₹)" hint="0 = no cap">
            <input
              type="number"
              min="0"
              className="field"
              value={c.maxDiscount ?? 0}
              onChange={(e) => onChange({ ...c, maxDiscount: Number(e.target.value) || 0 })}
            />
          </Field>
        )}

        <Field label="Minimum order (₹)" hint="0 = any">
          <input
            type="number"
            min="0"
            className="field"
            value={c.minOrder ?? 0}
            onChange={(e) => onChange({ ...c, minOrder: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="Uses allowed" hint="0 = unlimited">
          <input
            type="number"
            min="0"
            className="field"
            value={c.usageLimit ?? 0}
            onChange={(e) => onChange({ ...c, usageLimit: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="Valid from">
          <input
            type="date"
            className="field"
            value={c.startDate || ''}
            onChange={(e) => onChange({ ...c, startDate: e.target.value })}
          />
        </Field>

        <Field label="Valid until">
          <input
            type="date"
            className="field"
            value={c.endDate || ''}
            onChange={(e) => onChange({ ...c, endDate: e.target.value })}
          />
        </Field>

        <Field label="Note" className="sm:col-span-2 lg:col-span-3">
          <input
            className="field"
            value={c.label || ''}
            onChange={(e) => onChange({ ...c, label: e.target.value })}
            placeholder="10% off your first order"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-line bg-surface p-4" style={{ borderRadius: 'var(--r-btn)' }}>
          <Toggle
            checked={Boolean(c.firstOrderOnly)}
            onChange={(v) => onChange({ ...c, firstOrderOnly: v })}
            label="First order only"
            hint="For codes like SUKOON10."
          />
        </div>

        <Field label="Collections" hint="None = whole cart">
          <div className="flex flex-wrap gap-2">
            {COLLECTIONS.map(([slug, label]) => {
              const on = cats.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleCat(slug)}
                  className={`rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.8rem] transition-colors ${
                    on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface hover:border-brand'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <button type="button" onClick={onSave} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save row'}
        </button>
        <span className="text-[0.72rem] text-muted">
          {c.lastUsedAt ? `Last used ${dateLabel(c.lastUsedAt)}` : `Used ${c.used || 0} times`}
        </span>
        <ConfirmDelete onConfirm={onDelete} />
      </div>
    </div>
  );
}

export default function AdminCoupons() {
  const { toast } = useShop();
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState('');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => api.coupons().then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const addRow = async () => {
    setAdding(true);
    const code = `SUKOON${Math.floor(Math.random() * 90 + 10)}`;
    try {
      const c = await api.createCoupon({ code, active: true });
      setList((l) => [c, ...(l || [])]);
      setOpenId(c.id);
      toast('New row added — edit the code and save.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const save = async (c) => {
    setSaving(c.id);
    try {
      const saved = await api.updateCoupon(c.id, c);
      setList((l) => l.map((x) => (x.id === c.id ? saved : x)));
      toast('Saved.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving('');
    }
  };

  const toggleActive = async (c, active) => {
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, active } : x)));
    setSaving(c.id);
    try {
      const saved = await api.updateCoupon(c.id, { active });
      setList((l) => l.map((x) => (x.id === c.id ? { ...x, ...saved } : x)));
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
      toast('Row deleted.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (!list) {
    return (
      <div className="overflow-hidden border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse border-b border-line bg-bg2/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-[0.86rem] leading-relaxed text-muted">
          One coupon per row. Click a row to expand and edit. Toggle Active without opening.
        </p>
        <button type="button" onClick={addRow} disabled={adding} className="btn btn-primary shrink-0">
          <Plus size={15} /> {adding ? 'Adding…' : 'Add row'}
        </button>
      </div>

      {!list.length ? (
        <EmptyState
          icon={Ticket}
          title="No coupons yet"
          text="Add a row and set the code, discount, and rules."
          action={(
            <button type="button" onClick={addRow} className="btn btn-primary">
              <Plus size={15} /> Add row
            </button>
          )}
        />
      ) : (
        <div className="overflow-hidden border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-line bg-bg2 text-left text-[0.72rem] font-medium text-muted">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Applies to</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((c) => {
                  const open = openId === c.id;
                  const active = c.active !== false;
                  const exhausted = c.usageLimit > 0 && (c.used || 0) >= c.usageLimit;
                  const expired = c.endDate && c.endDate < new Date().toISOString().slice(0, 10);

                  return (
                    <Fragment key={c.id}>
                      <tr
                        className={`table-row cursor-pointer ${open ? 'bg-brand-soft/30' : ''}`}
                        onClick={() => setOpenId((id) => (id === c.id ? null : c.id))}
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`grid h-7 w-7 place-items-center rounded border border-line text-muted transition-transform ${
                              open ? 'rotate-180 border-brand text-brand' : ''
                            }`}
                          >
                            <ChevronDown size={14} />
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-[0.88rem] font-medium uppercase tracking-[0.08em]">{c.code}</p>
                          {(exhausted || expired) && (
                            <p className="mt-0.5 text-[0.7rem] text-sale">
                              {exhausted ? 'Exhausted' : 'Expired'}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[0.86rem] font-medium tnum">{discountLabel(c)}</td>
                        <td className="px-4 py-3 text-[0.8rem] capitalize text-muted">{rulesLabel(c)}</td>
                        <td className="px-4 py-3 text-[0.82rem] text-muted tnum">
                          {c.used || 0}{c.usageLimit > 0 ? ` / ${c.usageLimit}` : ''}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <RowSwitch
                            checked={active}
                            onChange={(v) => toggleActive(c, v)}
                            label={active ? 'Deactivate' : 'Activate'}
                          />
                        </td>
                      </tr>

                      <tr className="!border-0">
                        <td colSpan={6} className="p-0">
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                                className="overflow-hidden border-b border-line"
                              >
                                <CouponEditor
                                  c={c}
                                  saving={saving === c.id}
                                  onChange={(next) => setList((l) => l.map((x) => (x.id === c.id ? next : x)))}
                                  onSave={() => save(list.find((x) => x.id === c.id))}
                                  onDelete={() => remove(c.id)}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add another row at the foot of the table */}
          <button
            type="button"
            onClick={addRow}
            disabled={adding}
            className="flex w-full items-center justify-center gap-2 border-t border-dashed border-line px-5 py-3.5 text-[0.86rem] text-muted transition-colors hover:bg-bg2 hover:text-brand disabled:opacity-50"
          >
            <Plus size={15} /> {adding ? 'Adding…' : 'Add new row'}
          </button>
        </div>
      )}
    </div>
  );
}
