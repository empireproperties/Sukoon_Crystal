import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, getCustomerToken, setCustomerToken } from './api.js';

const AccountContext = createContext(null);
export const useAccount = () => useContext(AccountContext);

/**
 * Customer session. Separate from the admin session on purpose — the tokens are
 * scoped to different audiences server-side, so being signed in as one never
 * grants the other.
 */
export function AccountProvider({ children }) {
  const [user, setUser] = useState(null);
  /* `loading` starts true only when a token exists, so a signed-out visitor
     never sees a flash of skeleton on pages that check auth. */
  const [loading, setLoading] = useState(() => Boolean(getCustomerToken()));

  const refresh = useCallback(async () => {
    if (!getCustomerToken()) { setUser(null); setLoading(false); return null; }
    try {
      const { user: u } = await api.account();
      setUser(u);
      return u;
    } catch {
      /* Expired or revoked — api.js has already cleared the token. */
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const adopt = useCallback((res) => {
    setCustomerToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signIn = useCallback(async (email, password) => adopt(await api.accountLogin(email, password)), [adopt]);
  const register = useCallback(async (body) => adopt(await api.register(body)), [adopt]);

  const signOut = useCallback(() => {
    setCustomerToken(null);
    setUser(null);
  }, []);

  const save = useCallback(async (patch) => {
    const { user: u } = await api.saveAccount(patch);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signOut, save, refresh }),
    [user, loading, signIn, register, signOut, save, refresh]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
