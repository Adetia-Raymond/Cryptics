"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CandlestickData } from "lightweight-charts";
import { klinesToCandles, Kline } from "../../lib/chartUtils";
import { useMarketWS } from "../../hooks/useMarketWS";

interface Props {
  symbol: string; // e.g. BTCUSDT
  interval?: string; // e.g. 1m, 1h
  limit?: number;
  height?: number;
  className?: string;
}

export default function CandlestickChart({ symbol, interval = "1m", limit = 200, height = 320, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const seriesTypeRef = useRef<'candlestick' | 'area' | 'line' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);
  const warnedRef = useRef<{ noCandlestick?: boolean }>({});

  const { lastMessage, connected } = useMarketWS(symbol, `kline_${interval}`);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!containerRef.current) return;
      const c = containerRef.current as any;
      if (c.__lwc_initializing) return;
      c.__lwc_initializing = true;
      try {
        // fetch klines (use explicit backend URL in dev if provided)
        const publicApi = (process.env.NEXT_PUBLIC_API_URL as string) || "";
        const base = publicApi ? publicApi.replace(/\/$/, "") : "";
        const url = base
          ? `${base}/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
          : `/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

        const res = await fetch(url);
        const klines: Kline[] = await res.json();
        const candles = klinesToCandles(klines) as CandlestickData[];

        // Use loader which tries dynamic import and falls back to UMD CDN
        const lwcModule: any = await import("../../lib/lwcLoader").then((m) => m.loadLightweightCharts());

        // normalize createChart function from various module shapes
        let createChartFn: any = null;
        try {
          if (typeof lwcModule === "function") {
            createChartFn = lwcModule;
          } else if (lwcModule && typeof lwcModule.createChart === "function") {
            createChartFn = lwcModule.createChart.bind(lwcModule);
          } else if (lwcModule && lwcModule.default && typeof lwcModule.default.createChart === "function") {
            createChartFn = lwcModule.default.createChart.bind(lwcModule.default);
          } else if ((window as any).LightweightCharts && typeof (window as any).LightweightCharts.createChart === "function") {
            createChartFn = (window as any).LightweightCharts.createChart.bind((window as any).LightweightCharts);
          }
        } catch (e) {
          console.error("CandlestickChart: error while locating createChart", e, { lwcModule });
        }

        if (!createChartFn || typeof createChartFn !== "function") {
          console.error("CandlestickChart: createChart is not a function", { lwcModule });
          try { c.__lwc_initializing = false; } catch (e) {}
          return;
        }

        try {
          if (chartRef.current && typeof chartRef.current.remove === "function") {
            try { chartRef.current.remove(); } catch (e) {}
          }
        } catch (e) {}
        try {
          if (containerRef.current) containerRef.current.innerHTML = "";
        } catch (e) {}

        chartRef.current = createChartFn(containerRef.current, {
          width: containerRef.current.clientWidth,
          height,
          layout: { background: { color: "#0b1220" }, textColor: "#fff" },
          rightPriceScale: { scaleMargins: { top: 0.2, bottom: 0.2 } },
          timeScale: { timeVisible: true, secondsVisible: false },
        });

        // If the created chart doesn't expose expected API, try the global UMD factory as a fallback
        if ((!chartRef.current || typeof chartRef.current.addCandlestickSeries !== "function") && (window as any).LightweightCharts && typeof (window as any).LightweightCharts.createChart === "function") {
          try {
            console.debug("CandlestickChart: initial chart missing API — retrying with window.LightweightCharts.createChart");
            // Remove any DOM/previous chart produced by the first factory to avoid duplicate canvases
            try {
              if (chartRef.current && typeof chartRef.current.remove === "function") {
                chartRef.current.remove();
              }
            } catch (e) {}
            try {
              if (containerRef.current) containerRef.current.innerHTML = "";
            } catch (e) {}

            chartRef.current = (window as any).LightweightCharts.createChart(containerRef.current, {
              width: containerRef.current.clientWidth,
              height,
              layout: { background: { color: "#0b1220" }, textColor: "#fff" },
              rightPriceScale: { scaleMargins: { top: 0.2, bottom: 0.2 } },
              timeScale: { timeVisible: true, secondsVisible: false },
            });
          } catch (err) {
            // ignore — subsequent diagnostics will handle
            console.debug("CandlestickChart: fallback createChart via window.LightweightCharts failed", err);
          }
        }
        // Expose module + chart instance for debugging in the browser console
        try {
          (window as any).__lwc = { lwcModule, chartInstance: chartRef.current };
        } catch (e) {}

        // Diagnostic: ensure chart instance has expected API
        try {
          console.debug("CandlestickChart: created chart instance type:", chartRef.current?.constructor?.name, "typeof addCandlestickSeries:", typeof chartRef.current?.addCandlestickSeries);
          if (!chartRef.current || typeof chartRef.current.addCandlestickSeries !== "function") {
            if (!warnedRef.current.noCandlestick) {
              console.warn("CandlestickChart: chart instance missing addCandlestickSeries", {
                lwcModule,
                chartInstance: chartRef.current,
              });
              warnedRef.current.noCandlestick = true;
            }
            try {
              const summarize = (obj: any) => {
                if (obj == null) return String(obj);
                try {
                  const keys = Object.keys(obj || {}).slice(0, 50);
                  const map: any = {};
                  keys.forEach((k) => {
                    try {
                      map[k] = typeof (obj as any)[k];
                    } catch (e) {
                      map[k] = "<error>";
                    }
                  });
                  return map;
                } catch (e) {
                  return String(obj);
                }
              };

                console.debug("CandlestickChart: lwcModule summary:", summarize(lwcModule));
                console.debug("CandlestickChart: chartInstance summary:", summarize(chartRef.current));
                try {
                  console.debug("CandlestickChart: chartInstance proto keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(chartRef.current)).slice(0,50));
                } catch (e) {
                  console.debug("CandlestickChart: failed to get proto keys", e);
                }
                try {
                  console.debug("CandlestickChart: LightweightCharts global keys:", Object.getOwnPropertyNames((window as any).LightweightCharts || {}).slice(0,50));
                } catch (e) {
                  console.debug("CandlestickChart: failed to list global LightweightCharts keys", e);
                }
            } catch (e) {
              console.debug("CandlestickChart: diagnostic logging failed", e);
            }
            // attempt alternative: if module exposes a global factory
            // Try several fallbacks so the chart shows something useful even if candlestick API is missing
            if (lwcModule && typeof lwcModule.addCandlestickSeries === "function") {
              console.debug("CandlestickChart: using lwcModule.addCandlestickSeries fallback");
              candleSeriesRef.current = lwcModule.addCandlestickSeries(chartRef.current);
              seriesTypeRef.current = 'candlestick';
            } else if (chartRef.current && typeof chartRef.current.addCandlestickSeries === "function") {
              // defensive: some builds might expose it directly on instance
              candleSeriesRef.current = chartRef.current.addCandlestickSeries();
              seriesTypeRef.current = 'candlestick';
            } else if (chartRef.current && typeof chartRef.current.addSeries === "function") {
              // standalone UMD exposes built-in series descriptors on the global object
              const G = (window as any).LightweightCharts || {};
              const CandlestickDesc = G.CandlestickSeries || G.CandlestickSeries?.default || G.Candlestick || null;
              try {
                if (CandlestickDesc) {
                  console.debug("CandlestickChart: using addSeries(CandlestickSeries) fallback");
                  candleSeriesRef.current = chartRef.current.addSeries(CandlestickDesc, {});
                }
              } catch (e) {
                console.debug("CandlestickChart: addSeries(Candlestick) fallback failed", e);
              }
              // if still not created, try addCustomSeries
              if (!candleSeriesRef.current && typeof chartRef.current.addCustomSeries === "function") {
                try {
                  console.debug("CandlestickChart: using addCustomSeries fallback");
                  const CandlestickFactory = G.CandlestickSeries || G.CandlestickSeries?.default || null;
                  if (CandlestickFactory) candleSeriesRef.current = chartRef.current.addCustomSeries(CandlestickFactory, {}, 0);
                  seriesTypeRef.current = 'candlestick';
                } catch (e) {
                  console.debug("CandlestickChart: addCustomSeries fallback failed", e);
                }
              }
            } else if (chartRef.current && typeof chartRef.current.addAreaSeries === "function") {
              console.debug("CandlestickChart: addCandlestickSeries missing — falling back to addAreaSeries (close price)");
              candleSeriesRef.current = chartRef.current.addAreaSeries();
              seriesTypeRef.current = 'area';
              // convert candles to line points (use close)
              const line = (candles as any[]).map((c) => ({ time: c.time, value: c.close }));
              try { candleSeriesRef.current.setData(line); } catch (e) { console.debug("CandlestickChart: setData fallback failed", e); }
            } else if (chartRef.current && typeof chartRef.current.addLineSeries === "function") {
              console.debug("CandlestickChart: addCandlestickSeries missing — falling back to addLineSeries (close price)");
              candleSeriesRef.current = chartRef.current.addLineSeries();
              seriesTypeRef.current = 'line';
              const line = (candles as any[]).map((c) => ({ time: c.time, value: c.close }));
              try { candleSeriesRef.current.setData(line); } catch (e) { console.debug("CandlestickChart: setData fallback failed", e); }
            } else {
              console.warn("CandlestickChart: no suitable series API available on chart instance", { lwcModule, chartInstance: chartRef.current });
              try { c.__lwc_initializing = false; } catch (e) {}
              return;
            }
          } else {
            candleSeriesRef.current = chartRef.current.addCandlestickSeries();
            seriesTypeRef.current = 'candlestick';
          }
        } catch (e) {
          console.error("CandlestickChart: failed to create candlestick series", e, { lwcModule, chartInstance: chartRef.current });
          try { c.__lwc_initializing = false; } catch (ee) {}
          return;
        }
        try { 
          // setData expects different shapes depending on series type
          if (seriesTypeRef.current === 'candlestick' || seriesTypeRef.current === 'unknown') {
            candleSeriesRef.current.setData(candles);
          } else {
            const line = (candles as any[]).map((c) => ({ time: c.time, value: c.close }));
            candleSeriesRef.current.setData(line);
          }
        } catch (e) { console.debug("CandlestickChart: setData error", e); }
        setLoading(false);
        try { c.__lwc_initializing = false; } catch (e) {}
      } catch (e) {
        console.error("CandlestickChart: failed to init", e);
        try { (containerRef.current as any).__lwc_initializing = false; } catch (_) {}
      }
    }

    init();

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      mounted = false;
      ro.disconnect();
      try { chartRef.current?.remove(); } catch (e) {}
      chartRef.current = null;
    };
  }, [symbol, interval, limit]);

  // apply incoming kline messages (from backend relaying Binance kline stream)
  useEffect(() => {
    if (!lastMessage || !candleSeriesRef.current) return;
    try {
      // Binance kline message shape: { e: 'kline', E, s, k: { t, T, i, o, c, h, l, v, x, ... } }
      if (lastMessage.e === "kline" && lastMessage.k) {
        const k = lastMessage.k as any;
        // only handle the same interval
        // Note: backend forwards the exact binance stream requested (we requested kline_<interval>)
        const timeSec = Math.floor((k.t ?? k.T ?? Date.now()) / 1000);
        const candle = {
          time: timeSec,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        } as any;

        // Use update() — lightweight-charts will replace the last bar if time matches, or append otherwise.
        try {
          if (seriesTypeRef.current === 'candlestick' || seriesTypeRef.current === 'unknown') {
            candleSeriesRef.current.update(candle);
          } else {
            // area/line expect { time, value }
            const pt = { time: candle.time, value: candle.close };
            candleSeriesRef.current.update(pt);
          }
        } catch (e) {
          console.debug('CandlestickChart: update failed, skipping to avoid resetting series', e);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [lastMessage]);

  return (
    <div className={className}>
      <div className="flex justify-end pr-2 pt-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-yellow-500"}`} />
          <span>{connected ? "live" : "connecting"}</span>
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height }} />
      {loading && <div className="text-sm text-zinc-400">Loading chart...</div>}
    </div>
  );
}
