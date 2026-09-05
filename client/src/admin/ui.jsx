import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Check } from 'lucide-react';
import { useState } from 'react';

/** Slide-over panel used by every admin editor. */
export function SlideOver({ open, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className={`absolute right-0 top-0 flex h-full w-full ${width} flex-col border-l border-line bg-surface shadow-2xl`}
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-medium">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[0.78rem] text-muted">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="shrink-0 rounded-[var(--r-btn)] p-2 text-muted transition-colors hover:bg-bg2 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="border-t border-line bg-bg2 px-6 py-4">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Two-click delete so a demo never loses data by accident. */
export function ConfirmDelete({ onConfirm, label = 'Delete', className = '' }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (armed) { onConfirm(); setArmed(false); }
        else { setArmed(true); setTimeout(() => setArmed(false), 3000); }
      }}
      className={`flex items-center gap-2 rounded-[var(--r-btn)] px-3 py-2 text-[0.78rem] transition-colors ${
        armed ? 'bg-sale/10 text-sale' : 'text-muted hover:bg-sale/8 hover:text-sale'
      } ${className}`}
    >
      <Trash2 size={14} strokeWidth={1.7} /> {armed ? 'Click again to confirm' : label}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`}
      >
        <motion.span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[0.88rem]">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.76rem] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <div className={className}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <p className="mt-1.5 text-[0.74rem] text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="border border-line bg-surface py-16 text-center" style={{ borderRadius: 'var(--r-card)' }}>
      {Icon && <Icon size={28} strokeWidth={1.3} className="mx-auto text-muted" />}
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.86rem] text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, delta, index = 0 }) {
  const up = delta >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)] bg-brand-soft text-brand">
            <Icon size={16} strokeWidth={1.7} />
          </span>
        )}
        {delta !== undefined && (
          <span className={`text-[0.74rem] font-medium ${up ? 'text-ok' : 'text-sale'}`}>
            {up ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-semibold tnum">{value}</p>
      <p className="mt-1 text-[0.78rem] text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-[0.74rem] text-muted/80">{hint}</p>}
    </motion.div>
  );
}

export function SavedTick({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-[0.78rem] text-ok"
        >
          <Check size={13} strokeWidth={2.4} /> Saved
        </motion.span>
      )}
    </AnimatePresence>
  );
}
