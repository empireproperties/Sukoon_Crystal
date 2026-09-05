import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Plus, Percent, IndianRupee } from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Field, Toggle, ConfirmDelete, EmptyState } from './ui.jsx';

/* What a shopper actually gets, spelled out. Written from the same fields the
   server reads, so the preview cannot drift from what will be applied. */
function describe(c) {
  const off = c.type === 'flat' ? inr(c.value) : `${c.value}%`;
  const bits = [`${off} off`];
  if (c.type === 'percent' && c.maxDiscount > 0) bits.push(`up to ${inr(c.maxDiscount)}`);
  if (c.minOrder > 0) bits.push(`on orders over ${inr(c.minOrder)}`);
  return bits.join(', ');
}

function CouponCard({ c, onChange, onSave, onDelete, saving }) {
  const limited = c.usageLimit > 0;
  const exhausted = limited && (c.used || 0) >= c.usageLimit;
  const expired = c.endDate && c.endDate < new Date().toISOString().slice(0, 10);

  return (
    <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className="field !font-mono !text-[0.95rem] !uppercase !tracking-[0.1em]"
            value={c.code || ''}
            onChange={(e) => onChange({ ...c, code: e.target.value.toUpperCase() })}
            placeholder="SUKOON10"
          />
          <p className="mt-1.5 text-[0.78rem] text-muted">{describe(c)}</p>
        </div>
        <Toggle checked={c.active !== false} onChange={(v) => onChange({ ...c, active: v })} label="Active" />
      </div>

      {(exhausted || expired) && (
        <p className="mt-3 border border-sale/30 bg-sale/5 px-3 py-2 text-[0.78rem] text-sale"
           style={{ borderRadius: 'var(--r-btn)' }}>
          {exhausted ? 'Fully redeemed — raise the limit to keep using it.' : 'Past its end date.'}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Discount type">
          <select className="field" value={c.type || 'percent'}
            onChange={(e) => onChange({ ...c, type: e.target.value })}>
            <option value="percent">Percentage off</option>
            <option value="flat">Flat amount off</option>
          </select>
        </Field>
        <Field label={c.type === 'flat' ? 'Amount off (₹)' : 'Percent off (%)'}>
          <div className="relative">
            {c.type === 'flat'
              ? <IndianRupee size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              : <Percent size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
            <input type="number" min="0" className="field !pl-8" value={c.value ?? 0}
              onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })} />
          </div>
        </Field>

        {c.type !== 'flat' && (
          <Field label="Cap the discount at (₹)" hint="0 = no cap. Stops 30% off costing a fortune on a big basket.">
            <input type="number" min="0" className="field" value={c.maxDiscount ?? 0}
              onChange={(e) => onChange({ ...c, maxDiscount: Number(e.target.value) || 0 })} />
          </Field>
        )}
        <Field label="Minimum order (₹)" hint="0 = any order">
          <input type="number" min="0" className="field" value={c.minOrder ?? 0}
            onChange={(e) => onChange({ ...c, minOrder: Number(e.target.value) || 0 })} />
        </Field>

        <Field label="Total uses allowed" hint="0 = unlimited">
          <input type="number" min="0" className="field" value={c.usageLimit ?? 0}
            onChange={(e) => onChange({ ...c, usageLimit: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Times used" hint="Counted automatically when an order is placed">
          <input className="field" value={c.used || 0} disabled />
        </Field>

        <Field label="Valid from" hint="Leave blank to start now">
          <input type="date" className="field" value={c.startDate || ''}
            onChange={(e) => onChange({ ...c, startDate: e.target.value })} />
        </Field>
        <Field label="Valid until" hint="Leave blank to never expire">
          <input type="date" className="field" value={c.endDate || ''}
            onChange={(e) => onChange({ ...c, endDate: e.target.value })} />
        </Field>

        <Field label="Internal note" hint="Not shown to shoppers" className="sm:col-span-2">
          <input className="field" value={c.label || ''}
            onChange={(e) => onChange({ ...c, label: e.target.value })}
            placeholder="10% off your first order" />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <button onClick={onSave} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span className="text-[0.72rem] text-muted">
          {c.lastUsedAt ? `Last used ${dateLabel(c.lastUsedAt)}` : 'Never used'}
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

  const load = () => api.coupons().then(setList).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    const code = `SUKOON${Math.floor(Math.random() * 90 + 10)}`;
    try {
      const c = await api.createCoupon({ code });
      setList((l) => [c, ...(l || [])]);
    } catch (e) { toast(e.message, 'error'); }
  };

  const save = async (c) => {
    setSaving(c.id);
    try { const saved = await api.updateCoupon(c.id, c); setList((l) => l.map((x) => (x.id === c.id ? saved : x))); toast('Saved.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
    finally { setSaving(''); }
  };

  const remove = async (id) => {
    try { await api.deleteCoupon(id); setList((l) => l.filter((c) => c.id !== id)); toast('Deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  if (!list) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded bg-bg2" />)}</div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-[0.86rem] leading-relaxed text-muted">
          Codes shoppers can enter at checkout. The discount is worked out on the server from
          these rules — the browser only sends the code, so a discount can never be faked.
        </p>
        <button onClick={add} className="btn btn-primary shrink-0"><Plus size={15} /> New coupon</button>
      </div>

      {!list.length ? (
        <EmptyState icon={Ticket} title="No coupons yet"
          text="Create one and shoppers can use it at checkout straight away."
          action={<button onClick={add} className="btn btn-primary"><Plus size={15} /> New coupon</button>} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <CouponCard
                c={c}
                saving={saving === c.id}
                onChange={(next) => setList((l) => l.map((x) => (x.id === c.id ? next : x)))}
                onSave={() => save(list.find((x) => x.id === c.id))}
                onDelete={() => remove(c.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
