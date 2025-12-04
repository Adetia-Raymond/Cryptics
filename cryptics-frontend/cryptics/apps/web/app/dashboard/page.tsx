"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import MarketCard from "../../components/market-card";
import InsightsCard from "../../components/InsightsCard";
import { useVisibleSummaries } from "@/hooks/useVisibleSummaries";
const CandlestickChart = dynamic(() => import("../../components/lwc/CandlestickChart"), { ssr: false });
import InsightsDetailModal from "../../components/InsightsDetailModal";

// Simple inline symbol manager UI: supports async pre-validation before adding
const SymbolManager = React.memo(function SymbolManager({ selected, onAdd, onRemove }: { selected: string[]; onAdd: (s: string) => Promise<boolean | void>; onRemove: (s: string) => void }) {
  const [val, setVal] = useState("");
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const doAdd = async () => {
    const raw = val;
    const sym = (raw || "").trim().toUpperCase();
    if (!sym) return;
    setLoadingAdd(true);
    setError(null);
    try {
      // Delegate validation to parent; parent returns true if added, false if invalid
      const added = await onAdd(sym);
      if (!added) {
        setError("Symbol not found or unsupported");
      } else {
        setVal("");
        inputRef.current?.focus();
      }
    } catch (e) {
      setError("Error validating symbol");
    } finally {
      setLoadingAdd(false);
    }
  };

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doAdd(); }} placeholder="Add symbol e.g. SOLUSDT" className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-md w-full" />
          <button onClick={() => void doAdd()} className={`px-3 py-2 rounded-md ${loadingAdd ? 'bg-zinc-700' : 'bg-blue-600'}`} disabled={loadingAdd}>{loadingAdd ? 'Checking...' : 'Add'}</button>
        </div>
        {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((s) => (
            <div key={s} className="px-2 py-1 bg-zinc-800 rounded-md flex items-center gap-2">
              <span className="text-sm">{s}</span>
              <button onClick={() => onRemove(s)} className="text-xs text-zinc-400">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

interface PriceData {
  symbol: string;
  price: number | null;
  change24h: number | null;
  change24hPercent: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
}

export default function DashboardPage() {
  const DEFAULT_SELECTED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"];
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => DEFAULT_SELECTED_SYMBOLS);
  const [loading, setLoading] = useState(true);
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);

  // One shared summaries/ws hook for all visible cards
  const { observe, unobserve, getLatest, tick, fetchSnapshot, addExtraSymbol, removeExtraSymbol } = useVisibleSummaries({ flushMs: 500 });

  // Load persisted selection from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("market:selectedSymbols");
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) setSelectedSymbols(parsed.map((s) => s.toUpperCase()));
        } else {
          // Persist default selection when none exists
          window.localStorage.setItem("market:selectedSymbols", JSON.stringify(DEFAULT_SELECTED_SYMBOLS));
        }
      }
    } catch (e) {}
  }, []);

  // Persist selection
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("market:selectedSymbols", JSON.stringify(selectedSymbols));
    } catch (e) {}
  }, [selectedSymbols]);

  // Batched snapshot fetch for all selected symbols every 5s
  useEffect(() => {
    let mounted = true;
    async function doFetch() {
      if (!selectedSymbols || selectedSymbols.length === 0) return;
      try {
        await fetchSnapshot(selectedSymbols);
        // Hide initial loading after first successful fetch
        if (loading) setLoading(false);
      } catch (e) {}
    }
    // initial
    doFetch();
    const id = setInterval(() => { if (mounted) doFetch(); }, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [selectedSymbols, fetchSnapshot]);

  // Stabilize add/remove callbacks so SymbolManager doesn't re-render/unmount while typing
  const addSymbol = useCallback(async (s: string) => {
    const sym = (s || "").trim().toUpperCase();
    if (!sym) return false;

    // Prevent duplicates and limit
    const already = (selectedSymbols || []).includes(sym);
    if (already) return false;
    if ((selectedSymbols || []).length >= 6) return false;

    // Pre-validate symbol with backend summaries endpoint
    try {
      const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${backend.replace(/\/$/, "")}/market/summaries?symbols=${encodeURIComponent(sym)}`);
      if (!res.ok) {
        return false;
      }
      const json = await res.json();

      // backend may return array or object — normalize
      let summary: any = null;
      if (Array.isArray(json) && json.length > 0) summary = json[0];
      else if (json && Array.isArray(json.summaries) && json.summaries.length > 0) summary = json.summaries[0];
      else if (json && json.symbol) summary = json;

      // Consider valid if we have a last_price or klines or high/low info
      if (!summary) return false;
      const hasPrice = summary.last_price != null || summary.price != null || (summary.klines && summary.klines.length);
      const hasRange = summary.high_price != null || summary.low_price != null || summary.high != null || summary.low != null;
      if (!hasPrice && !hasRange) return false;

      // Passed validation — add
      setSelectedSymbols((prev) => {
        if (prev.includes(sym)) return prev;
        return [...prev, sym];
      });
      return true;
    } catch (e) {
      return false;
    }
  }, [setSelectedSymbols, selectedSymbols]);

  const removeSymbol = useCallback((s: string) => {
    setSelectedSymbols((prev) => prev.filter((x) => x !== s));
  }, [setSelectedSymbols]);

  // Parent-managed modalSymbol (single modal at a time)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-white">Market Overview</h1>
        <p className="text-zinc-400 mt-2">Real-time cryptocurrency prices and performance</p>
      </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-4 w-24 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-40" />
                      <Skeleton className="h-20 w-full mt-6" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <SymbolManager selected={selectedSymbols} onAdd={addSymbol} onRemove={removeSymbol} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-8">
                  {selectedSymbols.map((s) => (
                    <MarketCard key={s} symbol={s} observe={observe} unobserve={unobserve} getLatest={getLatest} tick={tick} onOpenChart={(sym) => setModalSymbol(sym)} />
                  ))}

                  {/* extra hardcoded MarketCard removed; `XRPUSDT` is provided via DEFAULT_SELECTED_SYMBOLS and persisted in localStorage */}
                </div>

                {/* Dedicated Insights bottom section */}
                <div className="mt-8">
                  <InsightsCard symbol={selectedSymbols[0] ?? "BTCUSDT"} onOpenDetail={(s) => setModalSymbol(s)} observe={observe} unobserve={unobserve} getLatest={getLatest} tick={tick} addExtraSymbol={addExtraSymbol} removeExtraSymbol={removeExtraSymbol} />
                </div>
              </div>
            )}

            {/* More sections can be added below */}
      
            {modalSymbol && (
              <InsightsDetailModal symbol={modalSymbol} onClose={() => setModalSymbol(null)} />
            )}

    </div>
  );
}
