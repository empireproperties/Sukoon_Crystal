import { motion } from 'framer-motion';
import { Truck, BadgeIndianRupee, RotateCcw, Headset } from 'lucide-react';

/* The four promises Sukoon makes at the point of purchase. The COD figures
   are the owner's actual rule: a ₹500 minimum order, ₹200 of it paid online,
   the balance to the courier. Stated the same way here, in the shipping policy
   and in the FAQ. */
export const TRUST_CARDS = [
  {
    icon: Truck,
    title: 'Free & fast delivery',
    text: 'Free shipping on prepaid orders above ₹999, dispatched within 1–3 days.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Cash on delivery',
    text: 'Available on orders above ₹500 with a ₹200 advance paid online.',
  },
  {
    icon: RotateCcw,
    title: 'Easy returns',
    text: '7-day replacement on any breakage or defect, no questions asked.',
  },
  {
    icon: Headset,
    title: '24 / 7 support',
    text: 'Message us any time — we answer personally, not with a bot.',
  },
];

export default function TrustCards({ className = '' }) {
  return (
    <section className={`wrap py-12 sm:py-16 ${className}`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TRUST_CARDS.map(({ icon: Icon, title, text }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className="border border-line bg-surface p-5 sm:p-6"
            style={{ borderRadius: 'var(--r-card)' }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--c-brand-soft)] text-brand">
              <Icon size={18} strokeWidth={1.7} />
            </span>
            <h3 className="mt-4 text-[0.92rem] font-medium leading-snug">{title}</h3>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">{text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
