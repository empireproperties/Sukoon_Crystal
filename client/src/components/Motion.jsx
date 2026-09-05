import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Deliberately small motion vocabulary: a short fade-up on scroll, a stagger
 * for grids, and a count-up for figures. Nothing that moves on its own,
 * nothing that follows the cursor.
 */
const EASE = [0.22, 0.61, 0.36, 1];

export function Reveal({ children, delay = 0, y = 16, className = '', duration = 0.45 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className = '', gap = 0.05 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-50px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export function CountUp({ to = 0, duration = 1100, prefix = '', suffix = '', format }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return;
        done.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          setN(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tnum">
      {prefix}
      {format ? format(n) : Math.round(n).toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

/** Drives a horizontal collection row with arrow controls. */
export function useScrollRow(step = 640) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft < 8,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  };

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return {
    ref,
    edge,
    onScroll: check,
    scrollBy: (dir) => ref.current?.scrollBy({ left: dir * step, behavior: 'smooth' }),
  };
}
