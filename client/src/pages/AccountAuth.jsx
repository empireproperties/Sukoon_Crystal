import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';

import { useAccount } from '../lib/account.jsx';
import { Monogram } from '../components/Ornaments.jsx';

/* Mirrors passwordProblem() on the server. The server still decides. */
const weak = (v) =>
  v.length < 10 ? 'At least 10 characters'
  : !/[a-z]/.test(v) || !/[A-Z]/.test(v) ? 'Needs an upper and a lower case letter'
  : !/[0-9]/.test(v) ? 'Needs a digit'
  : null;

/** Sign in / create account. Rendered by <Account/> whenever nobody is signed in. */
/**
 * @param start  'signin' by default. The birth-chart page opens on 'register'
 *               instead: someone who followed a free offer is almost never a
 *               returning customer, and landing them on a password field they
 *               have never set reads as a wall.
 */
export default function AccountAuth({ onDone, start = 'signin' }) {
  const { signIn, register } = useAccount();
  const [mode, setMode] = useState(start);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRegister = mode === 'register';
  const pwProblem = isRegister && form.password ? weak(form.password) : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (isRegister) await register(form);
      else await signIn(form.email, form.password);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap grid place-items-center py-14 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <div className="border border-line bg-surface p-7 shadow-[var(--shadow-card)]" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="text-center">
            <Monogram size={40} className="mx-auto" />
            <h1 className="mt-4 text-xl font-medium">{isRegister ? 'Create your account' : 'Sign in'}</h1>
            <p className="mt-1 text-[0.8rem] text-muted">
              {isRegister ? 'Track orders and raise returns in one place.' : 'Welcome back to Sukoon.'}
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isRegister && (
              <div>
                <label className="field-label" htmlFor="ac-n">Name</label>
                <div className="relative">
                  <User size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input id="ac-n" className="field !pl-9" value={form.name} onChange={set('name')} required autoComplete="name" />
                </div>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="ac-e">Email</label>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="ac-e" type="email" className="field !pl-9" value={form.email} onChange={set('email')} required autoComplete="email" />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="field-label" htmlFor="ac-p">Phone <span className="text-muted">(optional)</span></label>
                <div className="relative">
                  <Phone size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input id="ac-p" className="field !pl-9" value={form.phone} onChange={set('phone')} autoComplete="tel" />
                </div>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="ac-pw">Password</label>
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="ac-pw" type="password" className="field !pl-9" value={form.password} onChange={set('password')}
                  required autoComplete={isRegister ? 'new-password' : 'current-password'} />
              </div>
              {pwProblem && <p className="mt-1.5 text-[0.76rem] text-muted">{pwProblem}</p>}
            </div>

            {error && (
              <p className="border border-sale/30 bg-sale/5 px-3.5 py-2.5 text-[0.8rem] text-sale" style={{ borderRadius: 'var(--r-btn)' }}>
                {error}
              </p>
            )}

            <button className="btn btn-primary btn-lg w-full" disabled={busy || Boolean(pwProblem)}>
              {busy ? 'Please wait…' : <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={14} /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-[0.82rem] text-muted">
            {isRegister ? 'Already have an account?' : 'New to Sukoon?'}{' '}
            <button
              onClick={() => { setMode(isRegister ? 'signin' : 'register'); setError(''); }}
              /* Negative margin keeps the sentence tight while the tap area
                 reaches a usable height. */
              className="-my-2 py-2 text-brand underline underline-offset-2"
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
