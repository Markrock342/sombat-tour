import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSession, saveSession, clearSession } from './auth';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      async login(user) {
        await saveSession(user);
        setSession(user);
      },
      async logout() {
        await clearSession();
        setSession(null);
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
