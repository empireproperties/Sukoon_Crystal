/* Invoicing.
 *
 * An invoice number is issued once and then never changes -- it is a legal
 * record, not a view of the order. Reprinting an invoice must always produce
 * the same document, so the numbers, the tax split and the seller details are
 * frozen onto the order the first time it is generated.
 *
 * India-specific: prices in the catalogue are GST-inclusive, so tax is worked
 * backwards out of the line total rather than added on top. A sale inside Uttar
 * Pradesh (where the studio is) splits into CGST + SGST; anywhere else is IGST.
 */
import { db, save } from './db.js';

/* Gems, imitation jewellery and articles thereof. 3% is the common rate for
   this category; confirm with your accountant before the first filing. */
export const DEFAULT_GST_RATE = 3;
const HOME_STATE = 'Uttar Pradesh';

export const SELLER = {
  name: 'Sukoon Crystal Solutions',
  address: '1st Floor, A-97 Roorkee Road, Modi Puram, Meerut',
  state: HOME_STATE,
  email: 'sukoon.crystalsolutions@gmail.com',
  phone: '+91 90122 57555',
};

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** `SKN/2026-27/0001` — financial year, then a per-year sequence. */
function financialYear(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  /* The Indian financial year starts in April. */
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function nextInvoiceNumber(at) {
  const fy = financialYear(at);
  const used = (db.orders || [])
    .map((o) => o.invoice?.number)
    .filter((n) => typeof n === 'string' && n.includes(`/${fy}/`))
    .map((n) => Number(n.split('/').pop()) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `SKN/${fy}/${String(next).padStart(4, '0')}`;
}

/**
 * Splits a GST-inclusive total into net and tax.
 * gross = net * (1 + rate/100)  ->  net = gross / (1 + rate/100)
 */
export function taxBreakdown(gross, rate, interState) {
  const net = money(gross / (1 + rate / 100));
  const tax = money(gross - net);
  return interState
    ? { net, igst: tax, cgst: 0, sgst: 0, tax }
    : { net, igst: 0, cgst: money(tax / 2), sgst: money(tax - money(tax / 2)), tax };
}

/**
 * Returns the order's invoice, creating and persisting it on first call.
 * Subsequent calls return the stored document unchanged.
 */
export function ensureInvoice(order, { rate = DEFAULT_GST_RATE } = {}) {
  if (order.invoice) return order.invoice;

  const at = new Date().toISOString();
  const buyerState = (order.customer?.state || '').trim();
  /* No state on the order means we cannot prove it was inter-state, so treat it
     as local -- the conservative choice for a Meerut seller. */
  const interState = Boolean(buyerState) && buyerState.toLowerCase() !== HOME_STATE.toLowerCase();

  const lines = (order.items || []).map((it) => {
    const gross = money((it.price || 0) * (it.qty || 1));
    const t = taxBreakdown(gross, rate, interState);
    return {
      name: it.name, sku: it.sku || '', qty: it.qty || 1,
      unitPrice: money(it.price || 0), gross,
      net: t.net, cgst: t.cgst, sgst: t.sgst, igst: t.igst,
    };
  });

  const goods = money(lines.reduce((s, l) => s + l.gross, 0));
  const totals = taxBreakdown(goods, rate, interState);

  const invoice = {
    number: nextInvoiceNumber(at),
    issuedAt: at,
    financialYear: financialYear(at),
    seller: SELLER,
    buyer: {
      name: order.customer?.name || '',
      email: order.customer?.email || '',
      phone: order.customer?.phone || '',
      address: [order.customer?.address, order.customer?.city, order.customer?.state, order.customer?.pincode]
        .filter(Boolean).join(', '),
      state: buyerState || HOME_STATE,
    },
    orderNumber: order.number,
    orderDate: order.createdAt,
    payment: order.payment,
    rate,
    interState,
    lines,
    /* Shipping and discount are shown as-is; the tax split above covers goods. */
    goods,
    net: totals.net,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    tax: totals.tax,
    shipping: money(order.shipping || 0),
    discount: money(order.discount || 0),
    total: money(order.total || 0),
  };

  /* Frozen onto the order: the same document every time it is fetched. */
  const list = db.orders || [];
  const i = list.findIndex((o) => o.id === order.id);
  if (i > -1) {
    list[i] = { ...list[i], invoice };
    save();
  }
  return invoice;
}
