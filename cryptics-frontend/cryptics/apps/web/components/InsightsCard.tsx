"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useInsights } from "../hooks/useInsights";
import { getKlines } from "@cryptics/api";

const Sparkline = dynamic(() => import("./lwc/Sparkline"), { ssr: false });

type InsightsCardProps = {
  symbol: string;
  onOpenDetail?: (s: string) => void;
  observe?: (node: Element | null, symbol: string) => void;
  unobserve?: (node: Element | null) => void;
  getLatest?: (symbol: string) => any;
  tick?: number;
  addExtraSymbol?: (s: string) => void;
  removeExtraSymbol?: (s: string) => void;
};

export default function InsightsCard({ symbol, onOpenDetail, observe, unobserve, getLatest, tick, addExtraSymbol, removeExtraSymbol }: InsightsCardProps) {
  const TOP10 = [
    "BTCUSDT",
    "ETHUSDT",
    "USDTUSD",
    "XRPUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "USDCUSD",
    "TRXUSDT",
    "DOGEUSDT",
    "ADAUSDT",
  ];

  const [selectedSymbol, setSelectedSymbol] = React.useState<string>(symbol ?? TOP10[0]);
  // keep selectedSymbol in sync if parent prop changes
  // initialize from localStorage if present, then sync with prop
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("insights:selectedSymbol");
        if (raw) {
          const up = String(raw).toUpperCase();
          if (TOP10.includes(up)) setSelectedSymbol(up);
        }
      }
    } catch (e) {}
  }, []);

  React.useEffect(() => { if (symbol && symbol !== selectedSymbol) setSelectedSymbol(symbol); }, [symbol]);

  // Fetch insights once when the card mounts / symbol changes. Polling is disabled by default
  // to avoid hammering external sentiment APIs; users can manually refresh.
  const { data, isLoading, error, refresh } = useInsights(selectedSymbol, { enabled: true });

  // Normalize signal/ confidence shapes. Backend may return a nested
  // `signal` object (TradingSignal) or a simple string + confidence field.
  const rawSignal = (data as any)?.signal;
  let signalType: string = "HOLD";
  let confidence: number | null = null;
  if (typeof rawSignal === "string") {
    signalType = rawSignal;
    if ((data as any)?.confidence != null) confidence = Math.round(((data as any).confidence ?? 0) * 100);
  } else if (rawSignal && typeof rawSignal === "object") {
    signalType = rawSignal.signal ?? "HOLD";
    const c = rawSignal.confidence;
    if (c != null) confidence = typeof c === "number" && c <= 1 ? Math.round(c * 100) : Math.round(c);
  }
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [sparkData, setSparkData] = React.useState<number[]>([]);
  const SPARK_MAX = 24;
  const sparkRef = React.useRef<HTMLDivElement | null>(null);
  const [sparkSizeKey, setSparkSizeKey] = React.useState<string>("");
  const [showTooltip, setShowTooltip] = React.useState(false);
  // internal debug state removed for production
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const ddRef = React.useRef<HTMLDivElement | null>(null);

  // persist selection when it changes
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("insights:selectedSymbol", selectedSymbol);
    } catch (e) {}
  }, [selectedSymbol]);

  // close dropdown on outside click
  // Seed sparkline using market summaries (latest prices) rather than klines
  // simple downsample helper: pick evenly spaced samples from array
  function downsample(values: number[], target: number) {
    if (values.length <= target) return values.slice(-target);
    const out: number[] = [];
    const factor = values.length / target;
    for (let i = 0; i < target; i++) {
      const idx = Math.floor(i * factor);
      out.push(values[idx]);
    }
    return out;
  }

  React.useEffect(() => { setSparkData([]); }, [selectedSymbol]);

  React.useEffect(() => {
    try {
      if (sparkData.length > 0) return;
      const snap = getLatest ? getLatest(selectedSymbol) : null;
      // Prefer klines payload attached to summary when available
      const klines = snap?.klines ?? null;
      if (Array.isArray(klines) && klines.length) {
        const closes = klines.map((k: any) => {
          if (k == null) return NaN;
          if (typeof k === "object") return typeof k.close === "number" ? k.close : Number(k.close);
          // fallback for array-based klines
          return Number((k as any)[4]);
        }).filter((v: number) => !Number.isNaN(v));
        if (closes.length) {
          const vals = closes.length > SPARK_MAX ? downsample(closes.slice(-SPARK_MAX * 2), SPARK_MAX) : closes.slice(-SPARK_MAX);
          // If we received fewer than SPARK_MAX points, pad at the start using the earliest value
          const padded = vals.length < SPARK_MAX ? Array(SPARK_MAX - vals.length).fill(vals[0]).concat(vals) : vals;
          setSparkData(padded);
          return;
        }
      }
      // fallback: use last_price summary to fill buffer
      const last = snap?.last_price != null ? Number(snap.last_price) : null;
      if (last != null && !Number.isNaN(last)) {
        setSparkData(new Array(SPARK_MAX).fill(last));
      }
    } catch (e) {
      // ignore
    }
  }, [selectedSymbol]);
  // end seeding effect
  // Register this card for visible summaries so `getLatest` is populated by the parent hook
  React.useEffect(() => {
    const node = ref.current;
    if (!node || !observe) return;
    try {
      observe(node, selectedSymbol);
    } catch (e) {}
    // fetch a small initial kline snapshot once to seed the sparkline (mirror MarketCard behavior)
    (async () => {
      try {
        if (sparkData.length === 0) {
          const res = await getKlines(selectedSymbol, "1m", SPARK_MAX);
          const klines = (res as any).data ?? res;
          if (Array.isArray(klines) && klines.length) {
              const vals = klines.slice(-SPARK_MAX).map((k: any) => {
                const c = k.close ?? k[4];
                return typeof c === "number" ? c : parseFloat(String(c)) || 0;
              }).filter((v: number) => !isNaN(v));
              if (vals.length) {
                const padded = vals.length < SPARK_MAX ? Array(SPARK_MAX - vals.length).fill(vals[0]).concat(vals) : vals;
                setSparkData(padded);
              }
            }
        }
      } catch (e) {
        // ignore transient failures — WS will populate later
      }
    })();

    return () => { try { if (node && unobserve) unobserve(node); } catch (e) {} };
  }, [selectedSymbol, observe, unobserve]);

  // Ensure the selected symbol is included in the summaries queue even if not visible
  React.useEffect(() => {
    if (!addExtraSymbol) return;
    try {
      addExtraSymbol(selectedSymbol);
    } catch (e) {}
    return () => { try { if (removeExtraSymbol) removeExtraSymbol(selectedSymbol); } catch (e) {} };
  }, [selectedSymbol, addExtraSymbol, removeExtraSymbol]);

  // Append latest.last_price into the spark buffer whenever `tick` updates (driven by WS messages)
  React.useEffect(() => {
    try {
      if (!getLatest) return;
      const s = getLatest(selectedSymbol);
      const p = s?.last_price;
      if (p == null || Number.isNaN(Number(p))) return;
      const n = Number(p);
      setSparkData((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === n) return prev;
        const next = prev.length >= SPARK_MAX ? [...prev.slice(1), n] : [...prev, n];
        try { /* tick updated */ } catch (e) {}
        return next;
      });
    } catch (e) {
      // ignore
    }
  }, [tick, selectedSymbol, getLatest]);

  // If after initial seeding we still have a very small buffer, try one short delayed
  // fallback fetch of klines (covers offscreen cards or timing races). Only attempt
  // once per symbol change to avoid extra HTTP noise.
  const _fallbackAttempted = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (sparkData.length >= 3) {
      _fallbackAttempted.current = false;
      return;
    }
    if (_fallbackAttempted.current) return;
    _fallbackAttempted.current = true;
    const timer = setTimeout(async () => {
      try {
        // delayed fallback attempt (no debug log)
        const res = await getKlines(selectedSymbol, "1m", SPARK_MAX);
        const klines = (res as any).data ?? res;
        if (Array.isArray(klines) && klines.length) {
          const vals = klines.slice(-SPARK_MAX).map((k: any) => {
            const c = k.close ?? k[4];
            return typeof c === "number" ? c : parseFloat(String(c)) || 0;
          }).filter((v: number) => !isNaN(v));
          if (vals.length) {
            const padded = vals.length < SPARK_MAX ? Array(SPARK_MAX - vals.length).fill(vals[0]).concat(vals) : vals;
            setSparkData((prev) => (prev.length === 0 ? padded : prev));
          }
        }
      } catch (e) {
        // ignore transient failures
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedSymbol]);

  // When the insights `data` (signal) arrives for this symbol, ensure we have
  // real klines available by performing a single getKlines fetch if we haven't
  // already attempted one for this symbol. This covers cases where summaries
  // contain only `last_price` or sparse data but we still want full klines
  // after an insights response.
  const attemptedKlines = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!data) return;
    if (attemptedKlines.current.has(selectedSymbol)) return;
    attemptedKlines.current.add(selectedSymbol);
    (async () => {
      try {
        // insights arrived — fetch klines (no debug log)
        const res = await getKlines(selectedSymbol, "1m", SPARK_MAX);
        const klines = (res as any).data ?? res;
        if (Array.isArray(klines) && klines.length) {
          const vals = klines.slice(-SPARK_MAX).map((k: any) => {
            const c = k.close ?? k[4];
            return typeof c === "number" ? c : parseFloat(String(c)) || 0;
          }).filter((v: number) => !isNaN(v));
          if (vals.length) {
            const padded = vals.length < SPARK_MAX ? Array(SPARK_MAX - vals.length).fill(vals[0]).concat(vals) : vals;
            setSparkData(padded);
          }
        }
      } catch (e) {
        // ignore transient failures
      }
    })();
  }, [data, selectedSymbol]);

  // Watch sparkline container resize and force remount/update when dimensions change
  React.useEffect(() => {
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
      setSparkSizeKey(`${Math.round(el.clientWidth)}x${Math.round(el.clientHeight)}`);
    } catch (e) {
      // ignore if ResizeObserver not supported
    }
    return () => { try { ro?.disconnect(); } catch (e) {} };
  }, [sparkRef.current]);

  return (
    <Card className="bg-gradient-to-br from-slate-900/30 to-slate-800/20 border-slate-800/40">
      <div ref={ref} className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <CardTitle className="text-lg">{selectedSymbol}</CardTitle>
              <div className="relative" ref={ddRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center justify-between gap-2 bg-gradient-to-tr from-zinc-800/80 to-zinc-900/60 text-xs text-zinc-100 px-3 py-1 rounded-md border border-zinc-700 shadow-sm min-w-[96px] transition-all hover:from-zinc-700 hover:to-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono tracking-wider">{selectedSymbol}</span>
                    <span className="text-xs text-zinc-400">{/* small subtitle could go here */}</span>
                  </div>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 ${dropdownOpen ? 'bg-zinc-700' : ''}`}>
                    <svg className={`w-3 h-3 text-zinc-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {dropdownOpen && (
                  <div role="listbox" aria-label="Symbols" className="insights-dropdown absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg z-50 max-h-44 overflow-y-auto py-1">
                    {TOP10.map((s) => (
                      <div
                        key={s}
                        role="option"
                        aria-selected={s === selectedSymbol}
                        onClick={() => { setSelectedSymbol(s); setDropdownOpen(false); }}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-zinc-800 ${s === selectedSymbol ? 'bg-zinc-800 font-semibold' : ''}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <style>{`
                .insights-dropdown {
                  -webkit-overflow-scrolling: touch;
                }
                .insights-dropdown::-webkit-scrollbar { width: 8px; }
                .insights-dropdown::-webkit-scrollbar-track { background: #0b1220; }
                .insights-dropdown::-webkit-scrollbar-thumb { background: #334155; border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
                .insights-dropdown::-webkit-scrollbar-thumb:hover { background: #475569; }
                .insights-dropdown { scrollbar-width: thin; scrollbar-color: #334155 #0b1220; }
              `}</style>
            </div>
            <CardDescription className="text-sm text-zinc-400">{data?.sentiment?.summary ?? "Insight summary"}</CardDescription>
          </div>
            <div className="flex items-center gap-3">
            <div className="relative">
              <div
                role="button"
                tabIndex={0}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                className={`px-2 py-1 rounded-md text-xs font-semibold cursor-default outline-none ${signalType === "BUY" ? "bg-green-700 text-white" : signalType === "SELL" ? "bg-rose-700 text-white" : "bg-zinc-800 text-zinc-200"}`}
                aria-label={`Signal ${signalType}${confidence !== null ? `, ${confidence}% confidence` : ""}`}
              >
                {signalType}{confidence !== null ? ` • ${confidence}%` : ""}
              </div>

              {/* Tooltip: show short reasoning summary from available insight data */}
                {showTooltip && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-900/95 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 shadow-lg z-50">
                  <div className="font-semibold text-xs text-zinc-300 mb-1">Reasoning</div>
                  <div className="text-xs text-zinc-300">
                    {((data as any)?.technical && (data as any).technical.length > 0) ? (
                      <div className="mb-1">• {(data as any).technical[0].interpretation ?? (data as any).technical[0].name ?? (data as any).technical[0].value}</div>
                    ) : (data as any)?.technical_analysis ? (
                      <div className="mb-1">• {(data as any).technical_analysis?.macd_interpretation ?? (data as any).technical_analysis?.sma_trend ?? "Technical summary"}</div>
                    ) : null}
                    {data?.sentiment?.summary ? (
                      <div className="mb-1">• {data.sentiment.summary}</div>
                    ) : null}
                    {data?.opportunities && data.opportunities.length > 0 ? (
                      <div className="mb-0">• {data.opportunities[0].title ?? data.opportunities[0].description}</div>
                    ) : null}
                    {!data?.technical && !data?.sentiment && (!data?.opportunities || data.opportunities.length === 0) && (
                      <div className="text-zinc-500">No reasoning available</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="w-3/5">
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="text-2xl font-bold">
                {data ? (
                  // Prefer RSI if available, otherwise first technical value
                  ((data as any).technical_analysis?.rsi != null)
                    ? String(Math.round((data as any).technical_analysis.rsi * 100) / 100)
                    : (((data as any).technical && (data as any).technical[0]?.value) ?? "—")
                ) : "—"}
              </div>
            )}
            <div className="text-sm text-zinc-400">Primary technical metric</div>
          </div>
          <div className="w-2/5 h-20">
            {/* Sparkline expects a parent height */}
            <div className="w-full h-full" ref={sparkRef}>
              {sparkData.length === 0 ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <Sparkline key={`${selectedSymbol}-${sparkSizeKey || "auto"}`} className="w-full h-full" data={sparkData} />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-400">
          {(() => {
            const s = (data?.sentiment as any)?.sentiment_score ?? (data?.sentiment as any)?.score ?? null;
            const label = typeof s === 'number' ? `${Math.round(s * 100)}%` : "—";
            return (<div>Sentiment: <span className="text-zinc-200">{label}</span></div>);
          })()}
          <div className="flex items-center gap-2">
              <button onClick={() => refresh()} className="px-3 py-1 bg-zinc-800 rounded-md text-xs">Refresh</button>
              <button onClick={() => onOpenDetail?.(selectedSymbol)} className="px-3 py-1 bg-blue-600 rounded-md text-xs">Details</button>
            </div>
            <div className="ml-4 text-xs text-zinc-500" />
        </div>

        {error && <div className="text-amber-400 text-xs">Error loading insights</div>}
      </CardContent>
      </div>
    </Card>
  );
}
