import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';

import { api, setToken } from '../lib/api.js';
import { Monogram } from '../components/Ornaments.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      /* A first-run generated password must be replaced before anything else. */
      navigate(user?.mustChangePassword ? '/admin/password' : '/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg2 px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <div className="border border-line bg-surface p-8 shadow-[var(--shadow-card)]" style={{ borderRadius: 'var(--r-card)' }}>
          <div className="text-center">
            <Monogram size={44} className="mx-auto" />
            <h1 className="mt-5 text-xl font-medium">Sign in to the admin</h1>
            <p className="mt-1 text-[0.8rem] text-muted">Sukoon Crystal Solutions</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="field-label" htmlFor="lg-email">Email</label>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="lg-email" value={email} onChange={(e) => setEmail(e.target.value)} className="field !pl-9" type="email" required autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="lg-pass">Password</label>
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="lg-pass" value={password} onChange={(e) => setPassword(e.target.value)} className="field !pl-9" type="password" required autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <p className="border border-sale/30 bg-sale/5 px-3.5 py-2.5 text-[0.8rem] text-sale" style={{ borderRadius: 'var(--r-btn)' }}>
                {error}
              </p>
            )}

            <button className="btn btn-primary btn-lg w-full" disabled={busy}>
              {busy ? 'Signing in…' : <>Sign in <ArrowRight size={14} /></>}
            </button>
          </form>

        </div>

        <Link to="/" className="mt-5 flex items-center justify-center gap-1.5 text-[0.82rem] text-muted transition-colors hover:text-brand">
          <ArrowLeft size={13} /> Back to the store
        </Link>
      </motion.div>
    </div>
  );
}
