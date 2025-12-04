// packages/api/src/axios.ts
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Dev helper: persist debug events for refresh attempts (dev only)
function pushApiDebug(evt: { type: string; msg?: string; ts?: number }) {
  try {
    if (typeof window === 'undefined') return;
    if (process.env && process.env.NODE_ENV === 'production') return;
    const key = 'auth_api_debug_events';
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ ...evt, ts: evt.ts || Date.now() });
    localStorage.setItem(key, JSON.stringify(arr.slice(-100)));
  } catch (e) {}
}

// Auto-attach access token
api.interceptors.request.use((config: any) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      // ensure headers object exists and is writable
      config.headers = { ...(config.headers || {}) };
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: single-flight refresh on 401, then retry original request
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

async function doRefresh() {
  // Use fetch directly to avoid circular import with auth.ts which imports this axios instance
  const base = api.defaults.baseURL || "";
  const url = `${base.replace(/\/$/, "")}/auth/refresh`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // dev debug
  try {
    pushApiDebug({ type: 'doRefresh_attempt', msg: `POST ${url}`, ts: Date.now() });
  } catch (e) {}

  // Mark refresh in progress so other clients know to wait
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh_in_progress', '1');
      pushApiDebug({ type: 'doRefresh_flag_set', ts: Date.now() });
    }
  } catch (e) {}

  // If another client (AuthProvider) is already performing a refresh, wait briefly and then reuse rotated tokens from localStorage
  try {
    if (typeof window !== 'undefined') {
      const start = Date.now();
      const timeout = 5000; // wait up to 5s
      while (localStorage.getItem('refresh_in_progress') === '1' && Date.now() - start < timeout) {
        // small sleep
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      // If a refresh was in progress and finished, try to read rotated tokens from localStorage
      if (!localStorage.getItem('refresh_in_progress')) {
        const stored = localStorage.getItem('cryptics_auth');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.access_token) {
              pushApiDebug({ type: 'doRefresh_reuse_local', msg: 'reused access token from localStorage' });
              // clear our flag just in case (we didn't set it)
              try { localStorage.removeItem('refresh_in_progress'); } catch (e) {}
              return { access_token: parsed.access_token };
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  // Send credentials so httpOnly refresh cookie is included
  const resp = await fetch(url, { method: "POST", headers, credentials: 'include' });
  if (!resp.ok) {
    try { pushApiDebug({ type: 'doRefresh_failure', msg: `status=${resp.status}` }); } catch (e) {}
    try { localStorage.removeItem('refresh_in_progress'); } catch (e) {}
    throw new Error(`refresh failed ${resp.status}`);
  }
  try {
    const json = await resp.json();
    try { pushApiDebug({ type: 'doRefresh_success', msg: JSON.stringify({ access: !!json.access_token }) }); } catch (e) {}
    try { localStorage.removeItem('refresh_in_progress'); } catch (e) {}
    return json;
  } catch (e) {
    try { pushApiDebug({ type: 'doRefresh_parse_error', msg: String(e) }); } catch (err) {}
    try { localStorage.removeItem('refresh_in_progress'); } catch (err) {}
    throw e;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;
    if (!original || original._retry) return Promise.reject(error);

    if (error.response && error.response.status === 401) {
      original._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          const stored = typeof window !== "undefined" ? localStorage.getItem("cryptics_auth") : null;
          const parsed = stored ? JSON.parse(stored) : null;
          // doRefresh uses httpOnly cookie for refresh token now
          refreshPromise = doRefresh();
        }

        const res = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        // persist tokens and broadcast to other tabs
        if (typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem("cryptics_auth");
            const user = stored ? JSON.parse(stored).user : null;
            const newAuth = { access_token: res.access_token, user };
            localStorage.setItem("cryptics_auth", JSON.stringify(newAuth));
            localStorage.setItem("access_token", res.access_token);

            try {
              if ((window as any).BroadcastChannel) {
                const bc = new BroadcastChannel("auth");
                bc.postMessage({ type: "tokens", tokens: newAuth });
                bc.close();
              }
            } catch (e) {
              // ignore
            }
          } catch (e) {
            // ignore localStorage failures
          }
        }

        // retry original request with new token
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${res.access_token}` };
        return api(original);
      } catch (e) {
        // refresh failed -> clear storage and broadcast logout
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("cryptics_auth");
            localStorage.removeItem("access_token");
            if ((window as any).BroadcastChannel) {
              const bc = new BroadcastChannel("auth");
              bc.postMessage({ type: "logout" });
              bc.close();
            }
          } catch (err) {
            // ignore
          }
          // navigate to login page
          try {
            window.location.href = "/login";
          } catch (err) {
            // ignore
          }
        }

        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
