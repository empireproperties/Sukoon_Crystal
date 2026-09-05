import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Instagram, Clock, Send, ArrowUpRight } from 'lucide-react';

import { useShop } from '../lib/store.jsx';
import { Reveal } from '../components/Motion.jsx';


const FAQ = [
  { q: 'How long does delivery take?', a: 'Orders are dispatched within 48 hours and usually arrive in 3–6 working days across India.' },
  { q: 'Are the stones genuine?', a: 'Yes. Every batch is checked by hand before stringing, and we do not sell dyed glass under a stone name.' },
  { q: 'Can I get a custom bracelet?', a: 'That is most of what we do. Book a call and Swati will design one around your chart.' },
  { q: 'Do you ship outside India?', a: 'Not currently. Write to us and we will let you know when that changes.' },
];

export default function Contact() {
  const { settings, toast } = useShop();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'General enquiry', message: '' });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const phone = settings?.phone || '+91 90122 57555';
  const email = settings?.email || 'sukoon.crystalsolutions@gmail.com';
  const address = settings?.address || '1st Floor, A-97 Roorkee Road, Modi Puram, Meerut';

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    toast('Message received — we usually reply the same evening.', 'success');
    setForm({ name: '', email: '', phone: '', subject: 'General enquiry', message: '' });
    setTimeout(() => setSent(false), 4000);
  };

  const CARDS = [
    { icon: Phone, label: 'Call or WhatsApp', value: phone, href: `tel:${phone.replace(/\s/g, '')}`, note: 'Mon–Sat, 11am – 7pm' },
    { icon: Mail, label: 'Email us', value: email, href: `mailto:${email}`, note: 'Replies within one working day' },
    { icon: Instagram, label: 'Instagram', value: '@sukoon.crystalsolutions', href: settings?.instagram || 'https://instagram.com', note: 'Daily readings and live sessions' },
  ];

  return (
    <>
      <div className="border-b border-line bg-bg2">
        <div className="wrap py-10">
          <h1 className="text-3xl sm:text-4xl">Contact us</h1>
          <p className="mt-2.5 max-w-lg text-[0.94rem] leading-relaxed text-muted">
            Questions about a stone, an order or a reading — write, call, or walk into the studio.
            There is always a person on the other end.
          </p>
        </div>
      </div>

      <div className="wrap grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* --------------------------------------------------------- form */}
        <Reveal>
          <form onSubmit={submit} className="border border-line bg-surface p-6 sm:p-8" style={{ borderRadius: 'var(--r-card)' }}>
            <h2 className="text-lg font-medium">Send us a message</h2>
            <p className="mt-1.5 text-[0.86rem] text-muted">Swati reads every one herself.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="ct-name">Your name</label>
                <input id="ct-name" required value={form.name} onChange={set('name')} className="field" placeholder="Ananya Sharma" />
              </div>
              <div>
                <label className="field-label" htmlFor="ct-phone">Phone (optional)</label>
                <input id="ct-phone" value={form.phone} onChange={set('phone')} className="field" placeholder="+91 90000 00000" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="ct-email">Email</label>
                <input id="ct-email" required type="email" value={form.email} onChange={set('email')} className="field" placeholder="you@email.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="ct-subject">Subject</label>
                <select id="ct-subject" value={form.subject} onChange={set('subject')} className="field">
                  {['General enquiry', 'About an order', 'Custom bracelet', 'Consultation booking', 'Wholesale / bulk', 'Something else'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="ct-msg">Message</label>
                <textarea id="ct-msg" required rows={5} value={form.message} onChange={set('message')} className="field resize-none" placeholder="Tell us as much or as little as you like…" />
              </div>
            </div>

            <button className="btn btn-primary btn-lg mt-6 w-full sm:w-auto" disabled={sent}>
              {sent ? 'Message sent' : <>Send message <Send size={14} strokeWidth={1.9} /></>}
            </button>
            <p className="mt-4 text-[0.8rem] text-muted">
              Prefer to speak? <Link to="/book" className="text-brand underline underline-offset-2">Book a free call</Link> instead.
            </p>
          </form>

          {/* FAQ */}
          <section className="mt-8">
            <h2 className="text-lg font-medium">Common questions</h2>
            <dl className="mt-4 divide-y divide-line border border-line bg-surface" style={{ borderRadius: 'var(--r-card)' }}>
              {FAQ.map((f) => (
                <div key={f.q} className="p-5">
                  <dt className="text-[0.9rem] font-medium">{f.q}</dt>
                  <dd className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        {/* -------------------------------------------------------- details */}
        <aside className="space-y-4">
          {CARDS.map(({ icon: Icon, label, value, href, note }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="group flex items-start gap-4 border border-line bg-surface p-5 transition-colors hover:border-brand"
              style={{ borderRadius: 'var(--r-card)' }}
            >
              <Icon size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] text-muted">{label}</p>
                <p className="mt-0.5 break-words text-[0.92rem] font-medium">{value}</p>
                <p className="mt-0.5 text-[0.78rem] text-muted">{note}</p>
              </div>
              <ArrowUpRight size={15} className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          ))}

          <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
            <p className="flex items-center gap-2 text-[0.75rem] text-muted">
              <MapPin size={14} strokeWidth={1.7} className="text-accent" /> The studio
            </p>
            <p className="mt-2 text-[0.92rem] leading-relaxed">{address}</p>
            <a
              href="https://maps.google.com/?q=Modi+Puram+Meerut"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm mt-4 w-full"
            >
              Open in Google Maps
            </a>
          </div>

          <div className="border border-line bg-surface p-5" style={{ borderRadius: 'var(--r-card)' }}>
            <p className="flex items-center gap-2 text-[0.75rem] text-muted">
              <Clock size={14} strokeWidth={1.7} className="text-accent" /> Studio hours
            </p>
            <dl className="mt-3 space-y-2 text-[0.86rem]">
              {[['Monday – Saturday', '11:00 – 19:00'], ['Sunday', 'By appointment']].map(([d, t]) => (
                <div key={d} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0 last:pb-0">
                  <dt className="text-muted">{d}</dt><dd>{t}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
