import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

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

/**
 * Destructive actions ask first, in a dialog you have to answer.
 *
 * This used to be a button that armed itself for three seconds and deleted on
 * a second click -- which is indistinguishable from a double click, and gave
 * no chance to read what was about to go.
 */
export function ConfirmDelete({ onConfirm, label = 'Delete', what = 'this', className = '' }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  /* Escape closes it. A dialog that traps you is its own hazard. */
  useEffect(() => {
    if (!asking) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setAsking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking, busy]);

  /* Every caller sits inside a row or a panel that opens an editor on click. */
  const stop = (e) => e.stopPropagation();

  const confirm = async (e) => {
    stop(e);
    setBusy(true);
    try {
      await onConfirm();
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setAsking(true); }}
        className={`flex items-center gap-2 rounded-[var(--r-btn)] px-3 py-2 text-[0.78rem] text-muted transition-colors hover:bg-sale/8 hover:text-sale ${className}`}
      >
        <Trash2 size={14} strokeWidth={1.7} /> {label}
      </button>

      <AnimatePresence>
        {asking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { stop(e); if (!busy) setAsking(false); }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              onClick={stop}
              className="w-full max-w-[380px] border border-line bg-surface p-6 shadow-[var(--shadow-pop)]"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sale/10 text-sale">
                <Trash2 size={18} strokeWidth={1.7} />
              </span>
              <h2 className="mt-4 text-[1.05rem] font-medium">Are you sure you want to delete {what}?</h2>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">
                This cannot be undone.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className="btn btn-sm flex-1 bg-sale text-white disabled:opacity-60"
                >
                  <Trash2 size={13} strokeWidth={2} /> {busy ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { stop(e); setAsking(false); }}
                  disabled={busy}
                  className="btn btn-sm flex-1 border border-line disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
