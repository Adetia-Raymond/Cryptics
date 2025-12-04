import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import mobileApi, { getAccessToken, clearTokens, getRefreshToken } from '../api/mobileApi';

type User = any | null;

type AuthContextType = {
  user: User;
  initializing: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  lastRefreshAt?: string | null;
  lastRefreshError?: string | null;
};


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const consecutiveFailures = useRef(0);

  function stopAutoRefresh() {
    if (refreshTimer.current) {
      try {
        clearInterval(refreshTimer.current as any);
      } catch (e) {}
      refreshTimer.current = null;
    }
    consecutiveFailures.current = 0;
  }

  async function hasRefreshToken(): Promise<boolean> {
    try {
      const t = await getRefreshToken();
      return !!t;
    } catch (e) {
      return false;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    // Only schedule if we have a refresh token available; in some web
    // test flows the backend may set httpOnly cookies instead of
    // returning a refresh token in the JSON response. If no refresh
    // token is present we avoid auto-refresh to prevent immediate sign-outs.
    (async () => {
      if (!(await hasRefreshToken())) {
        return;
      }

      const interval = 4 * 60 * 1000; // 4 minutes
      refreshTimer.current = (setInterval(async () => {
        try {
          await mobileApi.refresh();
          await refreshUser();
          consecutiveFailures.current = 0;
          setLastRefreshAt(new Date().toISOString());
          setLastRefreshError(null);
        } catch (e: any) {
          console.error('[AuthContext] auto-refresh error', e);
          setLastRefreshError(String(e?.body || e?.message || e));
          consecutiveFailures.current += 1;
          // don't sign out immediately; allow a few retries in case of
          // transient network errors. Only sign out after 3 consecutive failures.
          if (consecutiveFailures.current >= 3) {
            try {
              await clearTokens();
            } catch (_) {}
            setUser(null);
            stopAutoRefresh();
          }
        }
      }, interval) as unknown) as number;
    })();
  }

  async function loadOnStart() {
    setInitializing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        setInitializing(false);
        return;
      }
      // Try to fetch current user
      const res = await mobileApi.fetchWithAuth('/user/me', { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        setUser(json);
        // start auto-refresh while user is signed in
        startAutoRefresh();
      } else {
        // If 401 or other, clear tokens and require login
        setUser(null);
        await clearTokens();
      }
    } catch (e) {
      // on error, assume not authenticated
      setUser(null);
      await clearTokens();
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    loadOnStart();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const resp = await mobileApi.login(email, password);
      // After login, fetch user
      const res = await mobileApi.fetchWithAuth('/user/me', { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        setUser(json);
        // start auto-refresh when login succeeds
        startAutoRefresh();
      }
      setLoading(false);
      return resp;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await mobileApi.logout();
    } finally {
      setUser(null);
      await clearTokens();
      stopAutoRefresh();
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await mobileApi.fetchWithAuth('/user/me', { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        setUser(json);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, initializing, loading, login, logout, refreshUser, lastRefreshAt, lastRefreshError }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
