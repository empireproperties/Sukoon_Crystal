import { useEffect, useState } from 'react';
import { Printer, X, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';

import { api, inr, dateLabel } from '../lib/api.js';

/* Printed through the browser rather than a PDF library: the same document,
   no extra dependency, and the owner can "Save as PDF" from the print dialog.
   The @media print block hides everything else on the page. */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #invoice-sheet, #invoice-sheet * { visibility: visible !important; }
  #invoice-sheet {
    position: absolute; inset: 0; margin: 0; padding: 24px;
    box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
    max-height: none !important; overflow: visible !important;
  }
  @page { size: A4; margin: 12mm; }
}`;

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-6 py-1 ${strong ? 'text-[0.95rem] font-semibold' : 'text-[0.84rem]'}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function Invoice({ orderId, onClose }) {
  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setInv(null);
    /* Through the shared api helper, so an expired token redirects to login and
       a dropped connection reports something a human can act on instead of the
       browser's bare "Failed to fetch". */
    api.invoice(orderId)
      .then((d) => { if (!cancelled) setInv(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [orderId, tries]);

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{PRINT_CSS}</style>

      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary" disabled={!inv}>
            <Printer size={15} /> Print / Save as PDF
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div id="invoice-sheet" className="max-h-[80vh] overflow-y-auto bg-white p-8 text-[#1a1a17]" style={{ borderRadius: 8 }}>
          {error ? (
            <div className="grid place-items-center gap-3 py-14 text-center">
              <AlertTriangle size={26} className="text-amber-600" strokeWidth={1.7} />
              <p className="max-w-sm text-[0.9rem] text-[#5a5248]">{error}</p>
              <button onClick={() => setTries((n) => n + 1)}
                className="mt-1 inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-[0.84rem] text-[#1a1a17] hover:bg-gray-50">
                <RotateCcw size={13} /> Try again
              </button>
            </div>
          ) : !inv ? (
            <p className="flex items-center justify-center gap-2 py-16 text-[0.9rem] text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Preparing the invoice…
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-200 pb-6">
                <div>
                  <p className="text-[1.35rem] font-semibold tracking-[0.12em]">SUKOON</p>
                  <p className="text-[0.62rem] uppercase tracking-[0.3em] text-gray-500">Crystal Solutions</p>
                  <p className="mt-3 max-w-[220px] text-[0.76rem] leading-relaxed text-gray-600">
                    {inv.seller.address}<br />{inv.seller.email}<br />{inv.seller.phone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.7rem] uppercase tracking-[0.2em] text-gray-500">Tax Invoice</p>
                  <p className="mt-1 text-[1.05rem] font-semibold">{inv.number}</p>
                  <p className="mt-2 text-[0.76rem] text-gray-600">
                    Issued {dateLabel(inv.issuedAt)}<br />
                    Order {inv.orderNumber} · {dateLabel(inv.orderDate)}<br />
                    Payment: {inv.payment}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-gray-500">Billed to</p>
                <p className="mt-1.5 text-[0.92rem] font-medium">{inv.buyer.name}</p>
                <p className="text-[0.8rem] leading-relaxed text-gray-600">
                  {inv.buyer.address}
                  {inv.buyer.phone && <><br />{inv.buyer.phone}</>}
                  {inv.buyer.email && <><br />{inv.buyer.email}</>}
                </p>
              </div>

              <table className="mt-6 w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr className="border-y border-gray-200 text-left">
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="py-2 px-2 text-center font-medium">Qty</th>
                    <th className="py-2 px-2 text-right font-medium">Rate</th>
                    <th className="py-2 pl-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2.5 pr-2">
                        {l.name}
                        {l.sku && <span className="block text-[0.7rem] text-gray-500">SKU {l.sku}</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center">{l.qty}</td>
                      <td className="py-2.5 px-2 text-right">{inr(l.unitPrice)}</td>
                      <td className="py-2.5 pl-2 text-right">{inr(l.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-5 ml-auto max-w-[300px] border-t border-gray-200 pt-3">
                <Row label={`Taxable value`} value={inr(inv.net)} />
                {inv.interState ? (
                  <Row label={`IGST @ ${inv.rate}%`} value={inr(inv.igst)} />
                ) : (
                  <>
                    <Row label={`CGST @ ${inv.rate / 2}%`} value={inr(inv.cgst)} />
                    <Row label={`SGST @ ${inv.rate / 2}%`} value={inr(inv.sgst)} />
                  </>
                )}
                {inv.shipping > 0 && <Row label="Shipping" value={inr(inv.shipping)} />}
                {inv.discount > 0 && <Row label="Discount" value={`− ${inr(inv.discount)}`} />}
                <div className="mt-2 border-t border-gray-300 pt-2">
                  <Row label="Total" value={inr(inv.total)} strong />
                </div>
              </div>

              <p className="mt-8 border-t border-gray-200 pt-4 text-[0.7rem] leading-relaxed text-gray-500">
                Prices are inclusive of GST. This is a computer-generated invoice and does not
                require a signature. Returns are accepted within 7 days of delivery under our
                Return &amp; Refund Policy.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
