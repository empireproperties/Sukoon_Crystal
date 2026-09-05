import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react';

import { api, setToken } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';
import { Field } from './ui.jsx';

/* Mirrors passwordProblem() in server/auth.js. The server is the authority --
   this only spares the user a round trip to be told the obvious. */
const RULES = [
  { label: 'At least 10 characters', ok: (v) => v.length >= 10 },
  { label: 'An upper and a lower case letter', ok: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'A digit', ok: (v) => /[0-9]/.test(v) },
  { label: 'Does not start with a word like “sukoon” or “admin”', ok: (v) => !/^(sukoon|password|admin|welcome|qwerty)/i.test(v) },
];

export default function ChangePassword() {
  const navigate = useNavigate();
  const { toast } = useShop();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forced, setForced] = useState(false);

  useEffect(() => {
    api.me().then(({ user }) => setForced(Boolean(user?.mustChangePassword))).catch(() => {});
  }, []);

  const failed = RULES.filter((r) => !r.ok(next));
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current && next && !failed.length && !mismatch;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError('');
    try {
      /* The old token is retired server-side, so store the fresh one or the
         very next request would 401 and bounce back to the login screen. */
      const { token } = await api.changePassword(current, next);
      setToken(token);
      toast('Password changed. Every other signed-in device was signed out.', 'success');
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-lg"
    >
      {forced && (
        <div className="mb-5 flex items-start gap-2.5 border border-accent/30 bg-accent/5 p-3.5" style={{ borderRadius: 'var(--r-btn)' }}>
          <AlertTriangle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[0.82rem] leading-relaxed text-muted">
            You are signed in with the password generated on first run. Choose your own before you
            do anything else — the generated one was printed to the server log.
          </p>
        </div>
      )}

      <div className="border border-line bg-surface p-7" style={{ borderRadius: 'var(--r-card)' }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[var(--r-btn)] bg-bg2 text-accent">
            <KeyRound size={18} strokeWidth={1.7} />
          </span>
          <div>
            <h2 className="text-lg font-medium">Change password</h2>
            <p className="text-[0.8rem] text-muted">Signs out every other device.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Current password">
            <input className="field" type="password" value={current} autoComplete="current-password"
              onChange={(e) => setCurrent(e.target.value)} required />
          </Field>

          <Field label="New password">
            <input className="field" type="password" value={next} autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)} required />
          </Field>

          <Field label="Confirm new password">
            <input className="field" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} required />
            {mismatch && <p className="mt-1.5 text-[0.78rem] text-sale">The two passwords do not match.</p>}
          </Field>

          <ul className="space-y-1.5 border border-line bg-bg2 p-3.5" style={{ borderRadius: 'var(--r-btn)' }}>
            {RULES.map((r) => {
              const ok = next.length > 0 && r.ok(next);
              return (
                <li key={r.label} className={`flex items-center gap-2 text-[0.78rem] ${ok ? 'text-ink' : 'text-muted'}`}>
                  <ShieldCheck size={13} strokeWidth={1.9} className={ok ? 'text-accent' : 'opacity-35'} />
                  {r.label}
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="border border-sale/30 bg-sale/5 px-3.5 py-2.5 text-[0.8rem] text-sale" style={{ borderRadius: 'var(--r-btn)' }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-lg w-full" disabled={busy || !ready}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
