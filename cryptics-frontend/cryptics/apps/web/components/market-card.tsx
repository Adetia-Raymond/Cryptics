"use client";

import React, { useEffect, useRef, useState } from "react";
import Sparkline from "./lwc/Sparkline";
import { getKlines } from "@cryptics/api";
import { TrendingUp, TrendingDown } from "./icons";
 
// MarketCard should NOT fetch klines or summaries on mount — it subscribes to WS via useVisibleSummaries
type MarketCardProps = {
  symbol: string;
  observe: (node: Element | null, symbol: string) => void;
  unobserve: (node: Element | null) => void;
  getLatest: (symbol: string) => any;
  tick: number;
  onOpenChart?: (symbol: string) => void;
};

export default function MarketCard({ symbol, observe, unobserve, getLatest, tick, onOpenChart }: MarketCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cleanSymbol = (symbol || "").trim().toUpperCase();

  // Defensive: if caller passed an empty/whitespace symbol, render a helpful placeholder
  if (!cleanSymbol) {
    return (
      <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-center h-64">
        <div className="text-sm text-zinc-400">Invalid symbol — please check the input</div>
      </div>
    );
  }
  // sparkData is a small ring buffer that we'll populate from WS `latest` values
  // We also fetch a small initial snapshot of klines once to avoid empty sparklines on first render
  const [sparkData, setSparkData] = useState<number[]>([]);
  const [notFound, setNotFound] = useState<boolean>(false);
  const SPARK_MAX = 24;

  // Append latest.last_price into the spark buffer whenever `tick` updates (driven by WS messages)
  useEffect(() => {
    try {
      const s = getLatest(symbol);
      const p = s?.last_price;
      if (p == null || Number.isNaN(Number(p))) return;
      const n = Number(p);
      setSparkData((prev) => {
        // avoid duplicate consecutive identical values flooding
        if (prev.length > 0 && prev[prev.length - 1] === n) return prev;
        const next = prev.length >= SPARK_MAX ? [...prev.slice(1), n] : [...prev, n];
        return next;
      });
    } catch (e) {
      // ignore
    }
  }, [tick, symbol, getLatest]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Subscribe this card for WS updates
    observe(node, cleanSymbol);

    // fetch a small initial kline snapshot once to seed the sparkline
    (async () => {
      try {
        // don't fetch if we already have spark data
        if (sparkData.length === 0) {
          const res = await getKlines(cleanSymbol, "1m", SPARK_MAX);
          const klines = (res as any).data ?? res;

          if (Array.isArray(klines) && klines.length) {
            const vals = klines
              .slice(-SPARK_MAX)
              .map((k: any) => {
                const c = k.close ?? k[4];
                return typeof c === "number" ? c : parseFloat(String(c)) || 0;
              })
              .filter((v: number) => !isNaN(v));

            if (vals.length) {
              setSparkData(vals);
            } else {
              // received klines but no usable values — treat as not found
              setNotFound(true);
              try { unobserve(node); } catch (e) {}
            }
          } else {
            // no klines returned — likely invalid symbol
            setNotFound(true);
            try { unobserve(node); } catch (e) {}
          }
        }
        // NOTE: parent component is responsible for batched snapshot fetches.
        // Avoid per-card forced snapshot to reduce HTTP chatter.
      } catch (e) {
        // ignore transient failures — WS will populate later
      }
    })();

    return () => {
      try { unobserve(node); } catch (e) {}
    };
  }, [cleanSymbol, observe, unobserve]);

  const latest = getLatest(cleanSymbol);
  // If a later WS snapshot arrives, clear notFound so the card can render normally
  useEffect(() => {
    if (latest && (latest.last_price != null || (latest.klines && latest.klines.length))) {
      if (notFound) setNotFound(false);
    }
  }, [latest]);
  const price = latest?.last_price;
  const change = latest?.change_pct_24h != null ? parseFloat(String(latest.change_pct_24h)) : null;
  const positive = change !== null ? change >= 0 : null;
  const [high, setHigh] = useState<number | null>(null);
  const [low, setLow] = useState<number | null>(null);
  const sparkRef = useRef<HTMLDivElement | null>(null);
  const [sparkSizeKey, setSparkSizeKey] = useState<string>("");

  const priceChange = latest?.price_change != null ? Number(latest.price_change) : null;

  // Watch sparkline container resize and force remount/update when dimensions change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = sparkRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        try {
          const w = Math.round(el.clientWidth);
          const h = Math.round(el.clientHeight);
          setSparkSizeKey(`${w}x${h}`);
        } catch (e) {}
      });
      ro.observe(el);
      // seed initial key
      setSparkSizeKey(`${Math.round(el.clientWidth)}x${Math.round(el.clientHeight)}`);
    } catch (e) {
      // ignore if ResizeObserver not supported
    }
    return () => { try { ro?.disconnect(); } catch (e) {} };
  }, [sparkRef.current]);

  useEffect(() => {
    // try to populate high/low from latest summary if present
    if (!latest) return;
    const src: any = latest;
    const h = src.high_price ?? src.high ?? src.h ?? null;
    const l = src.low_price ?? src.low ?? src.l ?? null;
    if (h != null) setHigh(Number(h));
    if (l != null) setLow(Number(l));
  }, [latest]);

  // Remember last-known non-null values so transient missing updates don't show misleading zeroes
  const prevPriceChangeRef = React.useRef<number | null>(null);
  const prevPctRef = React.useRef<number | null>(null);
  if (priceChange !== null) prevPriceChangeRef.current = priceChange;
  if (change !== null) prevPctRef.current = change;

  // formatable displays
  const formattedPct = (change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : (prevPctRef.current !== null ? `${prevPctRef.current >= 0 ? "+" : ""}${prevPctRef.current.toFixed(2)}%` : "–"));
  const formattedPriceChange = (priceChange !== null ? `${priceChange >= 0 ? "+" : ""}$${Math.abs(priceChange).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : (prevPriceChangeRef.current !== null ? `${prevPriceChangeRef.current >= 0 ? "+" : ""}$${Math.abs(prevPriceChangeRef.current).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "–"));

  if (notFound) {
    return (
      <div ref={ref} className="bg-zinc-900 rounded-lg p-4 flex flex-col justify-between h-64">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-md">
              <svg width="18" height="12" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 10L8 6L12 10L18 4L22 8" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-xl font-semibold text-white">{cleanSymbol}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-sm font-semibold text-zinc-400`}>
              Not found
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-zinc-400">No market data available for this symbol. It may be invalid or unsupported. Remove it from your list or try another symbol.</div>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-zinc-900 rounded-lg p-4 flex flex-col justify-between h-64 cursor-pointer" onClick={() => onOpenChart?.(cleanSymbol)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-md">
            <svg width="18" height="12" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 10L8 6L12 10L18 4L22 8" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{cleanSymbol}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-sm font-semibold ${positive === true ? "text-emerald-400" : positive === false ? "text-rose-500" : "text-zinc-300"}`}>
            {formattedPct}
          </div>
        </div>
      </div>

      <div className="mt-2 flex-1 flex flex-col justify-end">
        <div className="text-2xl font-semibold text-white">{price ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--"}</div>
        <div className="text-sm text-zinc-400 mt-1">{formattedPriceChange} <span className="text-zinc-500">(24h)</span></div>
        <div className="mt-3 h-24 w-full relative" ref={sparkRef}>
          {/* Compact candlestick if available, otherwise fallback sparkline */}
          {/* color switches green/red based on 24h percent; sharp lines and guides enabled */}
          <Sparkline key={sparkSizeKey || undefined} data={sparkData} className="w-full h-full" color={positive ? "#10b981" : "#ef4444"} sharp={true} showGuides={true} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
          <div>24h High: {high != null ? `$${high.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
          <div>24h Low: {low != null ? `$${low.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}</div>
        </div>
      </div>

      {/* Click opens parent-managed modal */}
    </div>
  );
}
