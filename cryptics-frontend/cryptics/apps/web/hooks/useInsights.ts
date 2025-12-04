"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { InsightsResponse } from "@/../../packages/api/src/insights";

interface UseInsightsOptions {
  enabled?: boolean;
  staleMs?: number;
  // polling is opt-in; undefined means no polling
  pollIntervalMs?: number | undefined;
}

export function useInsights(symbol: string | null, options: UseInsightsOptions = {}) {
  const { enabled = true, staleMs = 30_000, pollIntervalMs } = options;
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notFoundRef = useRef(false);
  const lastFetchRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (opts?: { force?: boolean }) => {
    if (!symbol) return;
    if (!enabled) return;
    const now = Date.now();
    if (!opts?.force && lastFetchRef.current && now - lastFetchRef.current < 1000) return;

    try {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      setIsLoading(true);
      setError(null);
      // Prefer explicit NEXT_PUBLIC_API_BASE; fall back to NEXT_PUBLIC_API_URL or localhost:8000
      const base = (process.env.NEXT_PUBLIC_API_BASE as string)
        || (process.env.NEXT_PUBLIC_API_URL as string)
        || "http://localhost:8000";
      // Use the backend's combined signal endpoint. The backend exposes
      // `/insights/signal/{symbol}` (not `/insights/{symbol}`), which was
      // the source of 404s for some symbols.
      // Attach Authorization header when an access token is available (stored by AuthProvider)
      const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${base}/insights/signal/${encodeURIComponent(symbol)}`, { signal: controllerRef.current.signal, credentials: token ? undefined : "include", headers });
      if (res.status === 404) {
        // mark not-found so polling can stop and callers can show a friendly message
        notFoundRef.current = true;
        setError("not_found");
        return;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (!mountedRef.current) return;
      setData(json as InsightsResponse);
      lastFetchRef.current = Date.now();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || String(err));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [symbol, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (symbol && enabled) fetchData();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [symbol, enabled, fetchData]);

  // polling (opt-in)
  useEffect(() => {
    if (!symbol || !enabled) return;
    if (!pollIntervalMs || typeof pollIntervalMs !== "number" || pollIntervalMs <= 0) return;
    const id = setInterval(() => {
      if (notFoundRef.current) return; // stop polling when resource is missing
      const now = Date.now();
      if (!lastFetchRef.current || now - (lastFetchRef.current ?? 0) >= pollIntervalMs) {
        fetchData();
      }
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [symbol, enabled, pollIntervalMs, fetchData]);

  const refresh = useCallback(() => fetchData({ force: true }), [fetchData]);

  return { data, isLoading, error, refresh };
}
