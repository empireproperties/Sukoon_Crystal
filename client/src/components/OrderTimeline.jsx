import { Check, Package, Truck, Home, ClipboardCheck, XCircle } from 'lucide-react';

import { dateLabel } from '../lib/api.js';

/* The five states an order moves through, in order. `cancelled` is not a step —
   it replaces the track entirely, because a cancelled order did not progress
   through packing and delivery and drawing it that way would be a lie. */
export const FLOW = [
  { id: 'placed', label: 'Placed', icon: ClipboardCheck },
  { id: 'confirmed', label: 'Confirmed', icon: Check },
  { id: 'packed', label: 'Packed', icon: Package },
  { id: 'in_transit', label: 'On the way', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: Home },
];

export const flowIndex = (status) => FLOW.findIndex((f) => f.id === status);

/**
 * Horizontal progress track. Compact by default; the labels and timestamps
 * appear underneath so the row itself stays one line on a phone.
 */
export default function OrderTimeline({ order, compact = false }) {
  if (order?.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2.5 text-[0.84rem] text-sale">
        <XCircle size={16} strokeWidth={1.8} />
        This order was cancelled.
      </div>
    );
  }

  const current = flowIndex(order?.status);
  const stampFor = (id) => order?.timeline?.find((t) => t.status === id)?.at;

  const dot = compact ? 'h-6 w-6' : 'h-9 w-9';
  const icon = compact ? 12 : 15;

  return (
    <ol className="flex items-start">
      {FLOW.map((f, i) => {
        const done = i <= current && current >= 0;
        const active = i === current;
        const at = stampFor(f.id);

        return (
          <li key={f.id} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              {/* Leading connector, drawn only between steps. */}
              {i > 0 && (
                <span
                  className="h-[2px] flex-1 transition-colors"
                  style={{ background: done ? 'var(--c-brand)' : 'var(--c-line)' }}
                />
              )}
              <span
                className={`grid ${dot} shrink-0 place-items-center rounded-full border-2 transition-colors`}
                style={{
                  borderColor: done ? 'var(--c-brand)' : 'var(--c-line)',
                  background: done ? 'var(--c-brand)' : 'var(--c-surface)',
                  color: done ? 'var(--c-onbrand)' : 'var(--c-muted)',
                  /* The step you are actually on gets a halo so the eye lands
                     on "where is it now" rather than counting filled circles. */
                  boxShadow: active ? '0 0 0 4px color-mix(in oklab, var(--c-brand) 18%, transparent)' : 'none',
                }}
              >
                <f.icon size={icon} strokeWidth={2} />
              </span>
              {i < FLOW.length - 1 && (
                <span
                  className="h-[2px] flex-1 transition-colors"
                  style={{ background: i < current ? 'var(--c-brand)' : 'var(--c-line)' }}
                />
              )}
            </div>

            <p className={`mt-2 text-center leading-tight ${compact ? 'text-[0.62rem]' : 'text-[0.72rem]'} ${
              done ? 'text-ink' : 'text-muted'
            }`}>
              {f.label}
            </p>
            {!compact && at && (
              <p className="mt-0.5 text-center text-[0.64rem] text-muted">
                {dateLabel(at, { day: 'numeric', month: 'short' })}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
