"use client";

import { useEffect, useRef, useState } from "react";

type Summary = {
  symbol: string;
  last_price: number | null;
  change_pct_24h?: string | null;
  volume?: number | null;
  ts?: number;
};

/**
 * useVisibleSummaries
 * - register elements to observe via `observe(node, symbol)`
 * - maintains a Map of latest summaries
 * - opens a single WS to `/market/ws/summaries?symbols=...` for the current visible set (debounced)
 */
export function useVisibleSummaries(opts?: { batchMs?: number; flushMs?: number }) {
  const batchMs = opts?.batchMs ?? 200;
  const flushMs = opts?.flushMs ?? 250;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeToSymbol = useRef(new Map<Element, string>());
  const visibleSet = useRef(new Set<string>());

  const wsRef = useRef<WebSocket | null>(null);
  const pendingVisibleChange = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraSymbolsRef = useRef<Set<string>>(new Set());

  const latest = useRef<Map<string, Summary>>(new Map());
  const [tick, setTick] = useState(0);

  // buffer incoming updates and flush to UI on interval
  useEffect(() => {
    const id = setInterval(() => {
      if (latest.current.size > 0) {
        setTick((t) => t + 1);
      }
    }, flushMs);
    return () => clearInterval(id);
  }, [flushMs]);

  // helper to build query param and (re)connect ws
  function connectWS(symbols: string[]) {
    try {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }

      // combine with extraSymbols (explicitly requested symbols)
      const extras = Array.from(extraSymbolsRef.current || []);
      const all = Array.from(new Set([...(symbols || []), ...extras]));
      if (!all || all.length === 0) return;
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const param = encodeURIComponent(all.join(","));
      const url = base.replace(/^http/, "ws") + `/market/ws/summaries?symbols=${param}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "summary" && msg.data) {
            const d = msg.data as Summary;
            latest.current.set(d.symbol, d);
          } else if (msg.type === "batch" && Array.isArray(msg.data)) {
            for (const d of msg.data) latest.current.set(d.symbol, d as Summary);
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        // try reconnect in a bit if still have visible symbols
        setTimeout(() => {
          const s = Array.from(visibleSet.current);
          if (s.length) connectWS(s);
        }, 1000);
      };
    } catch (e) {
      // ignore
    }
  }

  // when visible set changes, debounce and reconnect ws
  function scheduleVisibleUpdate() {
    if (pendingVisibleChange.current) clearTimeout(pendingVisibleChange.current);
    pendingVisibleChange.current = setTimeout(() => {
      const symbols = Array.from(visibleSet.current);
      connectWS(symbols);
    }, batchMs);
  }

  function addExtraSymbol(symbol: string) {
    if (!symbol) return;
    extraSymbolsRef.current.add(symbol.toUpperCase());
    scheduleVisibleUpdate();
  }

  function removeExtraSymbol(symbol: string) {
    if (!symbol) return;
    extraSymbolsRef.current.delete(symbol.toUpperCase());
    scheduleVisibleUpdate();
  }

  // observe nodes
  function observe(node: Element | null, symbol: string) {
    if (!observerRef.current && typeof window !== "undefined") {
      observerRef.current = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const s = nodeToSymbol.current.get(e.target as Element);
          if (!s) continue;
          if (e.isIntersecting) {
            visibleSet.current.add(s);
          } else {
            visibleSet.current.delete(s);
          }
        }
        scheduleVisibleUpdate();
      }, { threshold: 0.15 });
    }

    if (node) {
      nodeToSymbol.current.set(node, symbol);
      observerRef.current?.observe(node);
    }
  }

  // unobserve
  function unobserve(node: Element | null) {
    if (!node) return;
    const s = nodeToSymbol.current.get(node);
    nodeToSymbol.current.delete(node);
    visibleSet.current.delete(s as string);
    observerRef.current?.unobserve(node);
    scheduleVisibleUpdate();
  }

  // initial snapshot via REST: fetch summaries for initial visible set
  async function fetchSnapshot(symbols: string[]) {
    if (!symbols || symbols.length === 0) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const param = encodeURIComponent(symbols.join(","));
      const res = await fetch(`${base.replace(/\/$/, "")}/market/summaries?symbols=${param}`);
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.summaries)) {
        for (const s of json.summaries) latest.current.set(s.symbol, s as Summary);
        setTick((t) => t + 1);
      }
    } catch (e) {
      // ignore
    }
  }

  // public getter
  function getLatest(symbol: string): Summary | undefined {
    return latest.current.get(symbol);
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    observe,
    unobserve,
    getLatest,
    // small value to trigger UI updates when buffered data is flushed
    tick,
    fetchSnapshot,
    addExtraSymbol,
    removeExtraSymbol,
  } as const;
}

export type { Summary };
