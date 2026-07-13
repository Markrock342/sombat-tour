import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout, setAuthToken, fetchMe } from '../data/api';

const STORAGE_KEY = 'sombat_auth_v1';

const AuthContext = createContext({
  user: null,
  token: null,
  ready: false,
  login: async () => {},
  logout: async () => {},
  canWrite: false,
  canSeePartsPrice: false,
  isAdmin: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.token) {
            setAuthToken(saved.token);
            setToken(saved.token);
            setUser(saved.user || null);
            try {
              const me = await fetchMe();
              setUser(me.user);
            } catch (_) {
              setAuthToken(null);
              setToken(null);
              setUser(null);
              await AsyncStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      } catch (_) {
        /* ignore */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (username, pin) => {
    const data = await apiLogin(username, pin);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: data.token, user: data.user, expires: data.expires })
    );
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Real member.m_level is numeric (99=admin, 90=staff, others=technician).
  // Also accept the string roles used by newer code paths.
  const rawRole = user?.role ?? user?.level ?? '';
  const levelNum = Number(rawRole);
  const role = (() => {
    if (rawRole === 'admin' || rawRole === 'staff' || rawRole === 'technician' || rawRole === 'viewer') {
      return rawRole;
    }
    if (!Number.isNaN(levelNum)) {
      if (levelNum >= 99) return 'admin';
      if (levelNum >= 90) return 'staff';
      if (levelNum > 0) return 'technician';
      return 'viewer';
    }
    return user ? 'technician' : '';
  })();

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login,
      logout,
      // Any signed-in member (except pure viewer / level 0) can report repairs
      canWrite: !!user && ['admin', 'staff', 'technician'].includes(role),
      canSeePartsPrice: ['admin', 'staff'].includes(role),
      isAdmin: role === 'admin',
      role,
    }),
    [user, token, ready, login, logout, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
