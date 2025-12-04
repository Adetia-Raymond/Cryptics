"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { refreshToken, logout as apiLogout, api } from "@cryptics/api";
import Cookies from "js-cookie";

interface AuthData {
  access_token: string;
  user: any;
}

interface AuthContextValue {
  authData: AuthData | null;
  setAuthData: (data: AuthData) => void;
  logout: () => void;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authData, setAuthDataState] = useState<AuthData | null>(null);
  const [initialized, setInitialized] = useState(false);

  // load stored token
  useEffect(() => {
    // Clean up any legacy client-side refresh token/cookies created before switching
    try {
      // remove any js-cookie or localStorage copies of refresh/token
      Cookies.remove("refresh_token");
      Cookies.remove("token");
    } catch (e) {}
    try { localStorage.removeItem("refresh_token"); } catch (e) {}

    const stored = localStorage.getItem("cryptics_auth");
    if (stored) {
      // hydrate stored tokens and fetch current user profile
      const parsed = JSON.parse(stored) as any;
      // optimistically set tokens while we fetch the user
      setAuthDataState({ access_token: parsed.access_token, user: null });
      // ensure axios interceptor will send the access token for the /user/me request
      localStorage.setItem("access_token", parsed.access_token);
      (async () => {
        try {
          // helper to read exp from JWT (ms)
          function tokenExpMs(token?: string | null): number | null {
            if (!token) return null;
            try {
              const parts = token.split('.');
              if (parts.length < 2) return null;
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              return payload && payload.exp ? payload.exp * 1000 : null;
            } catch (e) {
              return null;
            }
          }

          // If token is expired or will expire within 30s, refresh first to avoid /user/me using stale token
          const expMs = tokenExpMs(parsed.access_token);
          const now = Date.now();
          if (!expMs || expMs - now < 30 * 1000) {
            try {
              // indicate refresh in progress so other clients coordinate
              try { localStorage.setItem('refresh_in_progress', '1'); } catch (e) {}
              const base = (api && (api as any).defaults && (api as any).defaults.baseURL) || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
              const url = `${String(base).replace(/\/$/, "")}/auth/refresh`;
              // Refresh uses httpOnly cookie now; no Authorization header required
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              const resp = await fetch(url, { method: 'POST', headers, credentials: 'include' });
              if (!resp.ok) {
                // refresh failed — clear stored auth and bail out
                try { localStorage.removeItem('refresh_in_progress'); } catch (e) {}
                localStorage.removeItem("cryptics_auth");
                localStorage.removeItem("access_token");
                setAuthDataState(null);
                return;
              }
              const data = await resp.json();
              parsed.access_token = data.access_token;
              // Do not persist refresh_token to localStorage — it's now in httpOnly cookie
              localStorage.setItem("access_token", parsed.access_token);
              localStorage.setItem("cryptics_auth", JSON.stringify({ access_token: parsed.access_token, user: parsed.user || null }));
              try { localStorage.removeItem('refresh_in_progress'); } catch (e) {}
            } catch (e) {
              try { localStorage.removeItem('refresh_in_progress'); } catch (err) {}
              localStorage.removeItem("cryptics_auth");
              localStorage.removeItem("access_token");
              setAuthDataState(null);
              return;
            }
          }

          // now safe to call /user/me with fresh token
          const res = await api.get("/user/me");
          setAuthData({
            access_token: parsed.access_token,
            user: res.data,
          });
        } catch {
          // if fetching user fails, clear stored auth
          localStorage.removeItem("cryptics_auth");
          localStorage.removeItem("access_token");
          setAuthDataState(null);
        }
      })();
    }
    // mark initialized whether we found auth or not so layouts can stop showing redirects
    setInitialized(true);
  }, []);

    function setAuthData(data: AuthData) {
      // Persist only access token and user; refresh token is stored as httpOnly cookie by backend
      localStorage.setItem("cryptics_auth", JSON.stringify({ access_token: data.access_token, user: data.user || null }));
      localStorage.setItem("access_token", data.access_token);
      setAuthDataState(data);
    }

  async function logout() {
    try {
      // best-effort notify server (will also clear refresh cookie)
      await apiLogout();
    } catch {
      // ignore network errors
    }

    // clear local client-side tokens
    localStorage.removeItem("cryptics_auth");
    localStorage.removeItem("access_token");
    try {
      if ((window as any).BroadcastChannel) {
        const bc = new BroadcastChannel("auth");
        bc.postMessage({ type: "logout" });
        bc.close();
      }
    } catch (e) {
      // ignore
    }
    setAuthDataState(null);
    // navigate to login
    window.location.href = "/login";
  }

  // auto token refresh every 10 minutes
  useEffect(() => {
    // Listen for token updates from other tabs
    if (typeof window !== "undefined" && (window as any).BroadcastChannel) {
      const bc = new BroadcastChannel("auth");
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === "tokens") {
          try {
            localStorage.setItem("cryptics_auth", JSON.stringify(msg.tokens));
            localStorage.setItem("access_token", msg.tokens.access_token);
            setAuthDataState(msg.tokens);
          } catch (e) {
            // ignore
          }
        } else if (msg.type === "logout") {
          try {
            localStorage.removeItem("cryptics_auth");
            localStorage.removeItem("access_token");
          } catch (e) {}
          setAuthDataState(null);
          try {
            window.location.href = "/login";
          } catch (e) {}
        }
      };
      return () => bc.close();
    }

    // don't start refresh loop until we've initialized
    if (!initialized) return;

    let timer: number | null = null;
    let debugInterval: number | null = null;

    function clearTimer() {
      try {
        if (timer) window.clearTimeout(timer);
        if (debugInterval) window.clearInterval(debugInterval as unknown as number);
      } catch (e) {}
      timer = null;
      debugInterval = null;
    }

      // Dev helpers: persist debug events and show on-screen badge so logs survive page reloads
      function pushDebugEvent(evt: { type: string; msg?: string; ts?: number }) {
        try {
          if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV === 'production') return;
          const key = 'auth_debug_events';
          const raw = localStorage.getItem(key);
          const arr = raw ? JSON.parse(raw) : [];
          arr.push({ ...evt, ts: evt.ts || Date.now() });
          // keep last 50 events
          const sliced = arr.slice(-50);
          localStorage.setItem(key, JSON.stringify(sliced));
        } catch (e) {}
      }

      function ensureBadge() {
        try {
          if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV === 'production') return null;
          let el = document.getElementById('auth-debug-badge');
          if (!el) {
            el = document.createElement('div');
            el.id = 'auth-debug-badge';
            el.style.position = 'fixed';
            el.style.right = '12px';
            el.style.bottom = '12px';
            el.style.zIndex = '99999';
            el.style.background = 'rgba(0,0,0,0.7)';
            el.style.color = '#fff';
            el.style.padding = '8px 10px';
            el.style.fontSize = '12px';
            el.style.borderRadius = '6px';
            el.style.pointerEvents = 'none';
            el.style.maxWidth = '220px';
            el.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Auth (dev)</div><div id="auth-debug-body">idle</div>';
            document.body.appendChild(el);
          }
          return el as HTMLDivElement;
        } catch (e) { return null; }
      }

      function updateBadge(text: string) {
        try {
          const el = ensureBadge();
          if (!el) return;
          const body = el.querySelector('#auth-debug-body');
          if (body) body.textContent = text;
        } catch (e) {}
      }

    function getExpiryFromToken(token?: string): number | null {
      if (!token) return null;
      try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload || !payload.exp) return null;
        // exp is in seconds
        return payload.exp * 1000;
      } catch (e) {
        return null;
      }
    }

    async function doRefreshAndReschedule() {
      try {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          console.debug('[Auth] Refresh triggered');
          pushDebugEvent({ type: 'refresh_triggered' });
          updateBadge('Refreshing...');
        }
        // Use direct fetch for refresh to avoid axios interceptor races
        // Mark refresh in progress so other refresh callers (axios interceptor) can wait and reuse rotated tokens
        try {
          localStorage.setItem('refresh_in_progress', '1');
          pushDebugEvent({ type: 'refresh_flag_set' });
        } catch (e) {}
        const base = (api && (api as any).defaults && (api as any).defaults.baseURL) || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
        const url = `${String(base).replace(/\/$/, "")}/auth/refresh`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        // Refresh uses httpOnly cookie now; include credentials so cookie is sent
        const resp = await fetch(url, { method: 'POST', headers, credentials: 'include' });
        if (!resp.ok) {
          // record and throw to trigger logout
          try { pushDebugEvent({ type: 'doRefresh_failure_client', msg: `status=${resp.status}` }); } catch (e) {}
          throw new Error(`refresh failed ${resp.status}`);
        }
        const res = await resp.json();
        try {
          localStorage.removeItem('refresh_in_progress');
          pushDebugEvent({ type: 'refresh_flag_cleared' });
        } catch (e) {}
        localStorage.setItem("access_token", res.access_token);
        const userRes = await api.get("/user/me");
        setAuthData({ access_token: res.access_token, user: userRes.data });
        try { pushDebugEvent({ type: 'doRefresh_success_client', msg: JSON.stringify({ access: !!res.access_token }) }); } catch (e) {}
        
        // persist rotated access token (refresh token is stored in cookie)
        try {
          const stored = localStorage.getItem('cryptics_auth');
          const parsed = stored ? JSON.parse(stored) : { access_token: null, user: null };
          parsed.access_token = res.access_token;
          localStorage.setItem('cryptics_auth', JSON.stringify(parsed));
        } catch (e) {}

        // After successful refresh, schedule next refresh based on new token expiry
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          console.debug('[Auth] Refresh succeeded; scheduling next refresh');
          pushDebugEvent({ type: 'refresh_succeeded' });
        }
        scheduleNext();
      } catch (e) {
        logout();
      }
    }

    function scheduleNext() {
      clearTimer();
      const access = authData?.access_token || localStorage.getItem('access_token') || undefined;
      const expMs = getExpiryFromToken(access);

      if (expMs) {
        const now = Date.now();
        // refresh 25 seconds before expiry (buffer)
        const refreshAt = Math.max(0, expMs - now - 25 * 1000);
        // If token already expired or about to expire, refresh immediately
        if (refreshAt <= 0) {
          // use micro-task so we don't block render
          if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
            console.debug('[Auth] Access token expired or near expiry; refreshing now');
            pushDebugEvent({ type: 'refresh_immediate' });
            updateBadge('Refreshing now...');
          }
          timer = window.setTimeout(() => { doRefreshAndReschedule(); }, 50) as unknown as number;
        } else {
          if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
            console.debug('[Auth] Scheduling token refresh in', Math.round(refreshAt / 1000), 'seconds');
            pushDebugEvent({ type: 'schedule', msg: String(Math.round(refreshAt / 1000)) + 's' });
          }
          // start a debug interval to print remaining time every 5 seconds (dev only)
          if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
            try {
              if (debugInterval) window.clearInterval(debugInterval as unknown as number);
            } catch (e) {}
            debugInterval = window.setInterval(() => {
              const leftMs = Math.max(0, expMs - Date.now());
              const leftSec = Math.ceil(leftMs / 1000);
              console.debug('[Auth] Token expires in', leftSec, 'seconds');
              updateBadge(`Expires in ${leftSec}s`);
              pushDebugEvent({ type: 'countdown', msg: String(leftSec) + 's' });
              if (leftMs <= 0 && debugInterval) {
                try { window.clearInterval(debugInterval as unknown as number); } catch (e) {}
                debugInterval = null;
              }
            }, 5000) as unknown as number;
          }
          timer = window.setTimeout(() => { doRefreshAndReschedule(); }, refreshAt) as unknown as number;
        }
      } else {
        // fallback: periodic refresh every 10 minutes
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          console.debug('[Auth] No exp claim found; falling back to periodic refresh (10m)');
          pushDebugEvent({ type: 'fallback_periodic' });
          updateBadge('Using periodic refresh (10m)');
        }
        timer = window.setTimeout(() => { doRefreshAndReschedule(); }, 10 * 60 * 1000) as unknown as number;
      }
    }

    // start scheduling
    scheduleNext();

    return () => {
      clearTimer();
      try {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          const el = document.getElementById('auth-debug-badge');
          if (el) el.remove();
        }
      } catch (e) {}
    };
  }, [authData, initialized]);

  return (
    <AuthContext.Provider value={{ authData, setAuthData, logout, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
