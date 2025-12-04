/**
 * mobileApi.ts
 *
 * Mobile API helpers used by the Expo/React Native app.
 *
 * Backend expectations for mobile refresh support (important):
 * - The web uses an httpOnly cookie for refresh (`/auth/refresh`) and the server rotates refresh cookies.
 * - Native/mobile clients cannot access httpOnly cookies. To support mobile the backend must
 *   accept a refresh token in the request body and return rotated tokens in the response body.
 *   This project expects a mobile-friendly endpoint: `POST /auth/refresh_mobile` with body
 *   `{ refresh_token: string }` that returns `{ access_token, refresh_token }`.
 * - I added `/auth/refresh_mobile` to the backend so mobile refresh works out-of-the-box.
 * - Mobile stores `access_token` and `refresh_token` in secure storage (`expo-secure-store`) and
 *   uses them to call protected endpoints. Refresh tokens should be treated as highly sensitive.
 *
 * If you prefer path-based or different naming, update the `refresh()` implementation below.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, MOBILE_REFRESH_STRATEGY } from '../config/env';

type Tokens = {
  accessToken: string;
  refreshToken?: string;
};

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

// Small storage wrapper: prefer expo-secure-store on native platforms, but always use
// localStorage on web. Also protect against runtime errors in some expo-secure-store
// web builds by falling back to localStorage on error.
const useSecureStore = Platform.OS !== 'web' && typeof (SecureStore as any)?.getItemAsync === 'function';

async function storageSet(key: string, value: string) {
  if (useSecureStore) {
    try {
      return await (SecureStore as any).setItemAsync(key, value);
    } catch (e) {
      // fallback to localStorage on any runtime error
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // ignore
  }
}

async function storageGet(key: string) {
  if (useSecureStore) {
    try {
      return await (SecureStore as any).getItemAsync(key);
    } catch (e) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    }
  }
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

async function storageDelete(key: string) {
  if (useSecureStore) {
    try {
      const fn = (SecureStore as any).deleteItemAsync || (SecureStore as any).deleteValueWithKeyAsync;
      if (typeof fn === 'function') {
        await fn.call(SecureStore, key);
        return;
      }
    } catch (e) {
      // fallthrough to localStorage
    }
  }
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}

async function saveTokens(tokens: Tokens) {
  if (tokens.accessToken) await storageSet(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) await storageSet(REFRESH_KEY, tokens.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return storageGet(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_KEY);
}

export async function clearTokens() {
  await storageDelete(ACCESS_KEY);
  await storageDelete(REFRESH_KEY);
}

async function postJSON(path: string, body: any, opts: RequestInit = {}) {
  // Build payload while being tolerant of accidentally double-stringified input.
  let payload: string;
  if (typeof body === 'string') {
    // Attempt to detect if the string was JSON.stringified twice (e.g. '"{...}"').
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === 'string') {
        // Unwrap one level: the inner string should be the real JSON
        payload = parsed;
      } else {
        // It's a valid object/array serialized as string; re-stringify to normalize
        payload = JSON.stringify(parsed);
      }
    } catch (e) {
      // Not parseable — send as-is
      payload = body;
    }
  } else {
    payload = JSON.stringify(body);
  }

  // Debug: log payload shape to help diagnose dev issues (can remove later)
  try {
    // Avoid logging sensitive token values in production — this is a dev-only aid.
    console.debug('[mobileApi] POST', path, { headers: opts.headers || {}, payloadPreview: payload?.slice?.(0, 200) });
  } catch (e) {}

  // Prevent opts.headers from completely overriding our merged headers
  const { headers: extraHeaders, ...otherOpts } = opts as any;
  const mergedHeaders = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: mergedHeaders,
    body: payload,
    ...otherOpts,
  });
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch (e) {
    // ignore parse error
  }
  if (!res.ok) throw { status: res.status, body: json || text };
  return json;
}

export async function login(email: string, password: string) {
  // Expects backend to respond with { access_token, refresh_token? }
  const json = await postJSON('/auth/login', { email, password }, { headers: { 'x-client-type': 'mobile' } });
  const tokens: Tokens = { accessToken: json.access_token || json.accessToken };
  if (json.refresh_token) tokens.refreshToken = json.refresh_token;
  await saveTokens(tokens);
  return json;
}

export async function register(payload: { name?: string; username?: string; email: string; password: string }) {
  // Ensure we send `username` (server expects this field)
  const body = {
    email: payload.email,
    username: payload.username || payload.name,
    password: payload.password,
  };

  const json = await postJSON('/auth/signup', body, { headers: { 'x-client-type': 'mobile' } });
  // backend may auto-login; if tokens present, save
  if (json?.access_token || json?.refresh_token) {
    const tokens: Tokens = { accessToken: json.access_token || json.accessToken };
    if (json.refresh_token) tokens.refreshToken = json.refresh_token;
    await saveTokens(tokens);
  }
  return json;
}

export async function refresh() {
  // Mobile refresh uses the mobile-friendly endpoint that accepts a refresh token in the body
  // Endpoint: POST /auth/refresh_mobile { refresh_token }
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('no refresh token available');

  // Dev debug: show masked token info (do NOT log full tokens in production)
  try {
    const masked = `${refreshToken.slice(0, 6)}...${refreshToken.slice(-6)}`;
    console.debug('[mobileApi] refresh() found refresh token length=', refreshToken.length, 'masked=', masked);
  } catch (e) {}

  try {
    const json = await postJSON('/auth/refresh_mobile', { refresh_token: refreshToken });
    console.debug('[mobileApi] refresh() server response', json);
    const tokens: Tokens = { accessToken: json.access_token || json.accessToken };
    if (json.refresh_token) tokens.refreshToken = json.refresh_token;
    await saveTokens(tokens);
    return tokens;
  } catch (e: any) {
    // Surface server response details to help debugging (dev only)
    try {
      console.error('[mobileApi] refresh() failed', e?.status || e, e?.body || e?.message || e);
    } catch (err) {}
    throw e;
  }
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
  } catch (e) {
    // ignore network errors on logout
  }
  await clearTokens();
}

// Helper to attach Authorization header and attempt a single refresh on 401
export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  let access = await getAccessToken();
  const tryRequest = async () => {
    const headers = { ...(init.headers || {}), ...(access ? { Authorization: `Bearer ${access}` } : {}) } as any;
    const res = await fetch(typeof input === 'string' ? `${API_URL}${input}` : (input as Request).url, {
      ...init,
      headers,
    });
    return res;
  };

  let res = await tryRequest();
  if (res.status === 401) {
    try {
      const tokens = await refresh();
      console.debug('[mobileApi] refresh succeeded, new access token saved');
      access = tokens.accessToken;
    } catch (e) {
      console.error('[mobileApi] refresh failed', e);
      await clearTokens();
      throw e;
    }
    // retry once
    res = await tryRequest();
  }
  return res;
}

// Domain helpers
export async function getKlines(symbol: string, interval = '1m', limit = 24) {
  const qs = `?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetchWithAuth(`/market/klines${qs}`);
  const json = await res.json();
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function getSummaries(symbols: string[]) {
  const qs = `?symbols=${encodeURIComponent(symbols.join(','))}&include_klines=false`;
  const res = await fetchWithAuth(`/market/summaries${qs}`);
  const json = await res.json();
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function getInsights(symbol: string) {
  const res = await fetchWithAuth(`/insights/signal/${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function getTechnical(symbol: string) {
  const res = await fetchWithAuth(`/insights/technical/${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export default {
  login,
  register,
  refresh,
  logout,
  getKlines,
  getSummaries,
  getInsights,
  getTechnical,
  fetchWithAuth,
};
