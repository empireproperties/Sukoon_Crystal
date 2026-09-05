import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, Package, Upload, Pencil, LayoutGrid, List, ImageOff, Eye, EyeOff, IndianRupee, TrendingUp,
} from 'lucide-react';

import { api, inr } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { CHAKRAS, ZODIAC } from '../components/Ornaments.jsx';
import { SlideOver, ConfirmDelete, Toggle, Field, EmptyState, StatCard } from './ui.jsx';

const CATEGORIES = [
  ['wellness-bracelets', 'Wellness Bracelets'],
  ['zodiac-bracelets', 'Zodiac Bracelets'],
  ['rudraksha', 'Rudraksha'],
  ['sukoon-special', 'Sukoon Special'],
];
const ELEMENTS = ['Fire', 'Earth', 'Air', 'Water', 'Aether'];

const blank = () => ({
  name: '', category: 'wellness-bracelets', price: 999, mrp: 1399, stock: 20,
  stone: '', description: '', benefits: [], chakra: 'Heart', element: 'Earth',
  zodiac: [], images: [], featured: false, bestseller: false, active: true,
});

export default function AdminProducts() {
  const { toast } = useShop();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [view, setView] = useState('grid');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], loading, reload } = useAsync(() => api.products({ all: '1' }), []);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return (products || [])
      .filter((p) => cat === 'all' || p.category === cat)
      .filter((p) => !t || `${p.name} ${p.stone} ${p.sku}`.toLowerCase().includes(t));
  }, [products, q, cat]);

  const stats = useMemo(() => ({
    total: (products || []).length,
    active: (products || []).filter((p) => p.active !== false).length,
    low: (products || []).filter((p) => p.stock <= 8).length,
    value: (products || []).reduce((t, p) => t + p.price * p.stock, 0),
  }), [products]);

  const patch = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  const save = async () => {
    if (!editing.name?.trim()) return toast('Give the product a name first.', 'warn');
    setSaving(true);
    try {
      const payload = {
        ...editing,
        price: Number(editing.price) || 0,
        mrp: Number(editing.mrp) || 0,
        stock: Number(editing.stock) || 0,
      };
      if (editing.id) await api.updateProduct(editing.id, payload);
      else await api.createProduct(payload);
      toast(editing.id ? 'Product updated.' : 'Product added.', 'success');
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await api.deleteProduct(id);
    toast('Product deleted.', 'success');
    setEditing(null);
    reload();
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      patch('images', [url, ...(editing.images || [])]);
      toast('Photo uploaded.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const addImageUrl = () => {
    const url = window.prompt('Paste an image URL');
    if (url?.startsWith('http')) patch('images', [...(editing.images || []), url]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} icon={Package} label="Products" value={stats.total} />
        <StatCard index={1} icon={Eye} label="Live on the store" value={stats.active} />
        <StatCard index={2} icon={TrendingUp} label="Low on stock" value={stats.low} hint="8 units or fewer" />
        <StatCard index={3} icon={IndianRupee} label="Stock value" value={inr(stats.value)} />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, stone or SKU…" className="field !pl-9" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="field !w-auto">
          <option value="all">All collections</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="flex rounded-[var(--r-btn)] border border-line bg-surface p-0.5">
          {[['grid', LayoutGrid], ['list', List]].map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`grid h-8 w-8 place-items-center rounded-[calc(var(--r-btn)-1px)] transition-colors ${
                view === v ? 'bg-brand text-onbrand' : 'text-muted hover:text-ink'
              }`}
              aria-label={`${v} view`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
        <button onClick={() => setEditing(blank())} className="btn btn-primary btn-sm">
          <Plus size={14} /> New product
        </button>
      </div>

      {/* list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-64" style={{ borderRadius: 'var(--r-card)' }} />)}
        </div>
      ) : !list.length ? (
        <EmptyState
          icon={Package}
          title="No products match"
          text="Try a different search or collection."
          action={<button onClick={() => { setQ(''); setCat('all'); }} className="btn btn-outline">Clear filters</button>}
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.3) }}
              onClick={() => setEditing({ ...p })}
              className="group overflow-hidden border border-line bg-surface text-left transition-colors hover:border-brand"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <div className="relative">
                <ProductImage product={p} className="aspect-square" zoom />
                <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-surface text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  <Pencil size={13} />
                </span>
                <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
                  {p.active === false && <span className="badge badge-sale bg-surface">Hidden</span>}
                  {p.featured && <span className="badge badge-brand bg-surface">Featured</span>}
                  {p.stock <= 8 && <span className="badge badge-sale bg-surface">{p.stock} left</span>}
                </div>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 text-[0.88rem] font-medium leading-snug">{p.name}</p>
                <p className="mt-1 line-clamp-1 text-[0.72rem] text-muted">{p.sku} · {p.stone}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[0.95rem] font-semibold tnum">{inr(p.price)}</span>
                  <span className="text-[0.74rem] text-muted">{p.sold} sold</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-line bg-bg2 text-left text-[0.72rem] font-medium text-muted">
                  {['Product', 'Collection', 'Price', 'Stock', 'Sold', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="table-row cursor-pointer" onClick={() => setEditing({ ...p })}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage product={p} className="h-11 w-11 shrink-0" imgClassName="rounded-[var(--r-btn)]" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-[0.86rem]">{p.name}</p>
                          <p className="text-[0.72rem] text-muted">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[0.8rem] capitalize text-muted">{p.category.replace(/-/g, ' ')}</td>
                    <td className="px-5 py-3 text-[0.86rem] font-medium tnum">{inr(p.price)}</td>
                    <td className={`px-5 py-3 text-[0.86rem] tnum ${p.stock <= 8 ? 'text-sale' : ''}`}>{p.stock}</td>
                    <td className="px-5 py-3 text-[0.86rem] text-muted tnum">{p.sold}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${p.active === false ? 'badge-neutral' : 'badge-ok'}`}>
                        {p.active === false ? 'Hidden' : 'Live'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-[0.78rem] text-brand">Edit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ editor */}
      <SlideOver
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit product' : 'New product'}
        subtitle={editing?.id ? `SKU ${editing.sku}` : 'Add a piece to the catalogue'}
        footer={
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add product'}
            </button>
            {editing?.id && <ConfirmDelete onConfirm={() => remove(editing.id)} />}
          </div>
        }
      >
        {editing && (
          <div className="space-y-6">
            {/* images */}
            <Field label="Product photos" hint="The first photo is used across the store. Drag-free: delete and re-add to reorder.">
              <div className="flex flex-wrap gap-2.5">
                {(editing.images || []).map((img, i) => (
                  <div key={img} className="group relative h-24 w-24 overflow-hidden border border-line" style={{ borderRadius: 'var(--r-btn)' }}>
                    <img src={img} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[0.58rem] text-onbrand">Main</span>
                    )}
                    <button
                      onClick={() => patch('images', editing.images.filter((x) => x !== img))}
                      className="absolute inset-0 grid place-items-center bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove photo"
                    >
                      <ImageOff size={16} className="text-white" />
                    </button>
                  </div>
                ))}
                <label className={`grid h-24 w-24 cursor-pointer place-items-center border border-dashed border-line text-muted transition-colors hover:border-brand hover:text-brand ${uploading ? 'opacity-50' : ''}`} style={{ borderRadius: 'var(--r-btn)' }}>
                  <span className="text-center">
                    <Upload size={16} className="mx-auto" />
                    <span className="mt-1 block text-[0.66rem]">{uploading ? 'Uploading' : 'Upload'}</span>
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                </label>
              </div>
              <button onClick={addImageUrl} className="mt-2 text-[0.78rem] text-brand link-underline">
                or paste an image URL
              </button>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" className="sm:col-span-2">
                <input value={editing.name} onChange={(e) => patch('name', e.target.value)} className="field" placeholder="Money Magnet Bracelet" />
              </Field>
              <Field label="Collection">
                <select value={editing.category} onChange={(e) => patch('category', e.target.value)} className="field">
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Stones used">
                <input value={editing.stone} onChange={(e) => patch('stone', e.target.value)} className="field" placeholder="Citrine & Pyrite" />
              </Field>
              <Field label="Selling price (₹)">
                <input type="number" value={editing.price} onChange={(e) => patch('price', e.target.value)} className="field" />
              </Field>
              <Field label="MRP (₹)" hint="Shown struck through">
                <input type="number" value={editing.mrp} onChange={(e) => patch('mrp', e.target.value)} className="field" />
              </Field>
              <Field label="Stock on hand">
                <input type="number" value={editing.stock} onChange={(e) => patch('stock', e.target.value)} className="field" />
              </Field>
              <Field label="Element">
                <select value={editing.element} onChange={(e) => patch('element', e.target.value)} className="field">
                  {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
                </select>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea rows={5} value={editing.description} onChange={(e) => patch('description', e.target.value)} className="field resize-none" placeholder="What it is, who it is for, what it helps with…" />
              </Field>
              <Field label="Key benefits" hint="One per line — shown as a checklist on the product page" className="sm:col-span-2">
                <textarea
                  rows={4}
                  value={(editing.benefits || []).join('\n')}
                  onChange={(e) => patch('benefits', e.target.value.split('\n').filter(Boolean))}
                  className="field resize-none"
                  placeholder={'Attracts abundance and opportunity\nDissolves scarcity thinking'}
                />
              </Field>
            </div>

            <Field label="Chakra">
              <div className="flex flex-wrap gap-2">
                {[...CHAKRAS.map((c) => c.name), 'All Seven'].map((c) => (
                  <button
                    key={c}
                    onClick={() => patch('chakra', c)}
                    className={`rounded-[var(--r-btn)] border px-3 py-1.5 text-[0.8rem] transition-colors ${
                      editing.chakra === c ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Suited to signs" hint="Drives the zodiac filter on the shop page">
              <div className="flex flex-wrap gap-1.5">
                {ZODIAC.map((z) => {
                  const on = (editing.zodiac || []).includes(z.id);
                  return (
                    <button
                      key={z.id}
                      onClick={() => patch('zodiac', on ? editing.zodiac.filter((x) => x !== z.id) : [...(editing.zodiac || []), z.id])}
                      className={`flex items-center gap-1.5 rounded-[var(--r-btn)] border px-2.5 py-1.5 text-[0.76rem] transition-colors ${
                        on ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand'
                      }`}
                    >
                      <span className="text-accent">{z.glyph}</span> {z.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="space-y-4 border border-line bg-bg2 p-5" style={{ borderRadius: 'var(--r-card)' }}>
              <Toggle checked={editing.active !== false} onChange={(v) => patch('active', v)} label="Visible on the store" hint="Turn off to hide it without deleting" />
              <Toggle checked={!!editing.featured} onChange={(v) => patch('featured', v)} label="Featured" hint="Appears in the hand-picked row on the home page" />
              <Toggle checked={!!editing.bestseller} onChange={(v) => patch('bestseller', v)} label="Show a bestseller badge" />
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
