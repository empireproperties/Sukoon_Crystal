import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

import { api } from '../lib/api.js';
import { useAsync } from '../lib/store.jsx';
import { CONTACT } from '../components/Footer.jsx';
import NotFound from './NotFound.jsx';

/* One renderer for every legal/policy page. The content comes from the `pages`
   collection, so adding a page is an admin action, not a code change. */
export default function PolicyPage({ handle: fixedHandle }) {
  const params = useParams();
  const handle = fixedHandle || params.handle;

  const page = useAsync(() => api.page(handle), [handle]);

  useEffect(() => { window.scrollTo(0, 0); }, [handle]);

  if (page.loading) {
    return (
      <div className="wrap py-20">
        <div className="h-8 w-64 animate-pulse rounded bg-bg2" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-bg2" style={{ width: `${70 + (i % 3) * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (page.error || !page.data) return <NotFound />;

  const { title, updated, sections = [] } = page.data;

  return (
    <>
      <section className="border-b border-line bg-bg2">
        <div className="wrap py-12 sm:py-16">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[0.82rem] text-muted transition-colors hover:text-brand">
            <ArrowLeft size={13} /> Back to the store
          </Link>
          <h1 className="mt-5 font-[var(--font-display)] text-[clamp(1.9rem,5vw,3rem)] leading-tight">{title}</h1>
          {updated && <p className="mt-2 text-[0.8rem] text-muted">Last updated: {updated}</p>}
        </div>
      </section>

      <article className="wrap max-w-3xl py-12 sm:py-16">
        {sections.map((s, i) => (
          <motion.section
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35 }}
            className={i ? 'mt-9' : ''}
          >
            {s.heading && (
              <h2 className="font-[var(--font-display)] text-[1.25rem] leading-snug sm:text-[1.4rem]">{s.heading}</h2>
            )}
            {(s.body || []).map((p, j) => (
              <p key={j} className={`text-[0.94rem] leading-relaxed text-muted ${s.heading || j ? 'mt-3' : ''}`}>{p}</p>
            ))}
            {s.list && (
              <ul className="mt-3 space-y-2">
                {s.list.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[0.94rem] leading-relaxed text-muted">
                    <span aria-hidden="true" className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        ))}

        <div className="mt-14 border border-line bg-bg2 p-6" style={{ borderRadius: 'var(--r-card)' }}>
          <h2 className="text-[0.95rem] font-medium">Still need help?</h2>
          <p className="mt-1.5 text-[0.86rem] text-muted">We answer personally, usually the same day.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`mailto:${CONTACT.email}`} className="btn border border-line">
              <Mail size={14} /> Email us
            </a>
            <a href={CONTACT.phoneHref} className="btn border border-line">
              <Phone size={14} /> {CONTACT.phone}
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
