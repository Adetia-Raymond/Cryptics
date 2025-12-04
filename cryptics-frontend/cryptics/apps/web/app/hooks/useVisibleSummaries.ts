"use client";

import { useEffect, useRef, useState } from "react";

type Summary = {
  symbol: string;
  last_price: number | null;
  change_pct_24h?: string | null;
  volume?: number | null;
  ts?: number;
};

export function useVisibleSummaries(opts?: { batchMs?: number; flushMs?: number }) {
  const batchMs = opts?.batchMs ?? 200;
  const flushMs = opts?.flushMs ?? 500;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeToSymbol = useRef(new Map<Element, string>());
  const visibleSet = useRef(new Set<string>());

  const wsRef = useRef<WebSocket | null>(null);
  const pendingVisibleChange = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraSymbolsRef = useRef<Set<string>>(new Set());
  const lastSentSymbols = useRef<string[] | null>(null);

  const latest = useRef<Map<string, Summary>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (latest.current.size > 0) {
        setTick((t) => t + 1);
      }
    }, flushMs);
    return () => clearInterval(id);
  }, [flushMs]);

  function connectWS(symbols: string[]) {
    try {
      // combine visible symbols with any explicitly requested extra symbols
      const extras = Array.from(extraSymbolsRef.current || []);
      const all = Array.from(new Set([...(symbols || []), ...extras]));
      if (!all || all.length === 0) {
        // if no symbols, close existing ws gracefully
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
          wsRef.current = null;
        }
        return;
      }

      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const param = encodeURIComponent(all.join(","));
      const url = base.replace(/^http/, "ws") + `/market/ws/summaries?symbols=${param}`;

      // normalize symbols for comparison
      const normalized = (symbols || []).map(s => s.toUpperCase()).filter(Boolean);
      normalized.sort();
      const sameAsLast = lastSentSymbols.current && normalized.length === lastSentSymbols.current.length && normalized.every((v, i) => v === lastSentSymbols.current![i]);

      // If an open socket exists, try to reuse it by sending a replace message
      if (wsRef.current) {
        const ready = wsRef.current.readyState;
        if (ready === WebSocket.OPEN) {
          try {
            // avoid sending replace when the symbol list hasn't changed
            if (!sameAsLast) {
              wsRef.current.send(JSON.stringify({ action: "replace", symbols }));
              lastSentSymbols.current = normalized;
            }
          } catch (e) {
            // if send fails, fallthrough to recreate
            try { wsRef.current.close(); } catch (err) {}
            wsRef.current = null;
          }
          return;
        }
        if (ready === WebSocket.CONNECTING) {
          // schedule replace once open
          const existing = wsRef.current;
          const onopen = () => {
            try { existing.send(JSON.stringify({ action: "replace", symbols })); } catch (e) {}
            existing.removeEventListener("open", onopen);
          };
          existing.addEventListener("open", onopen);
          return;
        }
        // otherwise it's CLOSING or CLOSED, clear reference
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
        lastSentSymbols.current = null;
      }

      // create new websocket
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "summary" && msg.data) {
            const d = msg.data as Summary;
            // merge incoming partial summary with any existing richer snapshot
            const existing = latest.current.get(d.symbol) || {};
            const merged = { ...existing, ...d } as Summary;
            latest.current.set(merged.symbol, merged);
          } else if (msg.type === "batch" && Array.isArray(msg.data)) {
            for (const d of msg.data) {
              const ex = latest.current.get(d.symbol) || {};
              const m = { ...ex, ...d } as Summary;
              latest.current.set(m.symbol, m);
            }
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        // try to reconnect after a backoff
        setTimeout(() => {
          const s = Array.from(visibleSet.current);
          if (s.length) connectWS(s);
        }, 1000 + Math.random() * 500);
        lastSentSymbols.current = null;
      };
    } catch (e) {}
  }

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
    // debug: symbol added to extras (previously logged)
    // Don't pre-warm individually; include extra symbols in batched fetchSnapshot calls.
    scheduleVisibleUpdate();
  }

  function removeExtraSymbol(symbol: string) {
    if (!symbol) return;
    // debug: symbol removed from extras (previously logged)
    extraSymbolsRef.current.delete(symbol.toUpperCase());
    scheduleVisibleUpdate();
  }

  function observe(node: Element | null, symbol: string) {
    if (!observerRef.current && typeof window !== "undefined") {
      observerRef.current = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const s = nodeToSymbol.current.get(e.target as Element);
          if (!s) continue;
          if (e.isIntersecting) visibleSet.current.add(s);
          else visibleSet.current.delete(s);
        }
        scheduleVisibleUpdate();
      }, { threshold: 0.15 });
    }
    if (node) {
      nodeToSymbol.current.set(node, symbol);
      observerRef.current?.observe(node);
    }
  }

  function unobserve(node: Element | null) {
    if (!node) return;
    const s = nodeToSymbol.current.get(node);
    nodeToSymbol.current.delete(node);
    visibleSet.current.delete(s as string);
    observerRef.current?.unobserve(node);
    scheduleVisibleUpdate();
  }

  const lastSnapshotFetch = useRef<Map<string, number>>(new Map());
  
  async function fetchSnapshot(symbols: string[], opts?: { force?: boolean; cooldownMs?: number; klineInterval?: string; klineLimit?: number }) {
    if (!symbols || symbols.length === 0) return;
    const cooldown = opts?.cooldownMs ?? 5000; // default 5s per symbol
    try {
      // include any extra symbols requested explicitly (e.g., the Insights selected symbol)
      const extras = Array.from(extraSymbolsRef.current || []);
      const requested = Array.from(new Set([...(symbols || []), ...extras]));
      const toFetch: string[] = [];
      const now = Date.now();
      for (const s of requested) {
        const last = lastSnapshotFetch.current.get(s.toUpperCase()) || 0;
        if (opts?.force) {
          toFetch.push(s);
        } else if (now - last > cooldown) {
          toFetch.push(s);
        }
      }
      if (toFetch.length === 0) return;

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const param = encodeURIComponent(toFetch.join(","));
      // If there are any extra symbols requested (e.g. Insights selected symbol), include small klines payload
      const includeKlines = (extraSymbolsRef.current && extraSymbolsRef.current.size > 0) || !!opts?.force ? true : false;
      const klineInterval = opts?.klineInterval ?? "1m";
      const klineLimit = opts?.klineLimit ?? 48;
      const qs = `symbols=${param}` + (includeKlines ? `&include_klines=true&kline_interval=${encodeURIComponent(klineInterval)}&kline_limit=${encodeURIComponent(String(klineLimit))}` : "");
      const res = await fetch(`${base.replace(/\/$/, "")}/market/summaries?${qs}`);
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.summaries)) {
        for (const s of json.summaries) {
          latest.current.set(s.symbol, s as Summary);
          lastSnapshotFetch.current.set(s.symbol.toUpperCase(), Date.now());
        }
        setTick((t) => t + 1);
      }
    } catch (e) {}
  }

  function getLatest(symbol: string): Summary | undefined { return latest.current.get(symbol); }

  useEffect(() => () => { if (observerRef.current) observerRef.current.disconnect(); if (wsRef.current) wsRef.current.close(); }, []);

  return { observe, unobserve, getLatest, tick, fetchSnapshot, addExtraSymbol, removeExtraSymbol } as const;
}

export type { Summary };
