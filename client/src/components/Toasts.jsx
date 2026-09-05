import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useShop } from '../lib/store.jsx';

const TONE = {
  gold: { Icon: Info, cls: 'text-brand' },
  success: { Icon: CheckCircle2, cls: 'text-ok' },
  warn: { Icon: AlertCircle, cls: 'text-accent' },
  error: { Icon: AlertCircle, cls: 'text-sale' },
};

export default function Toasts() {
  const { toasts } = useShop();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const { Icon, cls } = TONE[t.tone] || TONE.gold;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex max-w-sm items-start gap-2.5 border border-line bg-surface px-4 py-3 text-[0.85rem] shadow-[var(--shadow-pop)]"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <Icon size={16} strokeWidth={1.8} className={`mt-0.5 shrink-0 ${cls}`} />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
