import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Gift, ShieldCheck, Clock3, Loader2 } from 'lucide-react';

import { api } from '../lib/api.js';
import { useAccount } from '../lib/account.jsx';
import { useShop } from '../lib/store.jsx';
import BirthForm from '../components/BirthForm.jsx';
import Kundli from '../components/Kundli.jsx';
import AccountAuth from './AccountAuth.jsx';

const PROMISES = [
  { icon: Gift, title: 'Free, always', text: 'The chart and the reading cost nothing. No card, no trial.' },
  { icon: Clock3, title: 'About a minute', text: 'Three questions, and it is drawn while you wait.' },
  { icon: ShieldCheck, title: 'Kept in your account', text: 'Saved to your profile so it is there whenever you come back.' },
];

export default function BirthChartPage() {
  const { user, loading: authLoading, refresh } = useAccount();
  const { toast } = useShop();

  const [state, setState] = useState({ loading: true, chart: null, birth: null });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setState({ loading: false, chart: null, birth: null }); return; }
    try {
      const d = await api.myChart();
      setState({ loading: false, chart: d.chart, birth: d.birth });
      setEditing(!d.chart);
    } catch (e) {
      setState({ loading: false, chart: null, birth: null });
      toast(e.message, 'error');
    }
  }, [user, toast]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const draw = async (form) => {
    setBusy(true);
    try {
      const { chart } = await api.drawChart(form);
      setState((s) => ({ ...s, chart, birth: chart.birth }));
      setEditing(false);
      refresh?.();
      toast('Your chart is ready.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* The stored birth row uses the API's number fields; the form wants the
     values a date and time input understand. */
  const initial = state.birth && {
    date: `${state.birth.year}-${String(state.birth.month).padStart(2, '0')}-${String(state.birth.day).padStart(2, '0')}`,
    time: `${String(state.birth.hour).padStart(2, '0')}:${String(state.birth.minute).padStart(2, '0')}`,
    timeKnown: state.birth.timeKnown !== false,
    place: {
      name: state.birth.city, state: state.birth.state, country: state.birth.country,
      lat: state.birth.lat, lng: state.birth.lng, tz: state.birth.tz,
    },
  };

  const showChart = state.chart && !editing;

  return (
    <div className="wrap py-10 lg:py-14">
      {/* ─────────────────────────────────────────────────────────── intro */}
      {!showChart && (
        <motion.header
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[0.7rem] uppercase tracking-[0.16em] text-brand">
            <Sparkles size={12} strokeWidth={1.9} /> Free
          </p>
          <h1 className="mt-4 font-display text-[2rem] leading-[1.12] sm:text-[2.6rem]">
            Your birth chart, drawn properly
          </h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
            A real Vedic kundli from your date, time and place of birth — with your rising sign,
            your moon sign, your nakshatra, and an honest note on which stones your chart is
            actually asking for. Swati reads these every day. This one is on us.
          </p>
        </motion.header>
      )}

      {showChart && (
        <header className="mb-8">
          <h1 className="font-display text-[1.9rem] leading-tight sm:text-[2.3rem]">
            {user?.name ? `${user.name.split(' ')[0]}’s chart` : 'Your chart'}
          </h1>
          <p className="mt-1.5 text-[0.88rem] text-muted">
            Kept in your account. Come back to it whenever you like.
          </p>
        </header>
      )}

      {/* ──────────────────────────────────────────────────────── content */}
      <div className="mt-10">
        {authLoading || state.loading ? (
          <p className="flex items-center justify-center gap-2 py-20 text-[0.9rem] text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </p>
        ) : showChart ? (
          <Kundli chart={state.chart} onRedraw={() => setEditing(true)} />
        ) : (
          <div className="mx-auto max-w-xl">
            {!user ? (
              <>
                <div className="mb-8 grid gap-3 sm:grid-cols-3">
                  {PROMISES.map(({ icon: Icon, title, text }, i) => (
                    <motion.div
                      key={title}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08 }}
                      className="border border-line bg-surface p-4 text-center"
                      style={{ borderRadius: 'var(--r-card)' }}
                    >
                      <Icon size={17} strokeWidth={1.6} className="mx-auto text-brand" />
                      <p className="mt-2 text-[0.84rem] font-medium">{title}</p>
                      <p className="mt-1 text-[0.76rem] leading-snug text-muted">{text}</p>
                    </motion.div>
                  ))}
                </div>
                <p className="mb-5 text-center text-[0.86rem] text-muted">
                  Your chart is saved to your account, so it needs one first — it takes a moment.
                </p>
                <AccountAuth onDone={load} start="register" />
              </>
            ) : (
              <div className="border border-line bg-surface p-6 sm:p-8" style={{ borderRadius: 'var(--r-card)' }}>
                {state.chart && (
                  <button onClick={() => setEditing(false)} className="mb-5 text-[0.82rem] text-brand hover:underline">
                    ← Back to my chart
                  </button>
                )}
                <BirthForm
                  initial={initial}
                  busy={busy}
                  onSubmit={draw}
                  submitLabel={state.chart ? 'Redraw my chart' : 'Draw my chart'}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
