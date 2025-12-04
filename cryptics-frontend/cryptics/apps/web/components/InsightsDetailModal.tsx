"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { useInsights } from "../hooks/useInsights";

const CandlestickChart = dynamic(() => import("./lwc/CandlestickChart"), { ssr: false });

export default function InsightsDetailModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { data, isLoading, error, refresh } = useInsights(symbol ?? null, { enabled: !!symbol });
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [marketOps, setMarketOps] = useState<any[] | null>(null);

  // normalize signal shape (string or object)
  const rawSignal = (data as any)?.signal;
  const signalType = typeof rawSignal === "string" ? rawSignal : rawSignal?.signal ?? rawSignal?.action ?? null;
  const signalConfidence = typeof rawSignal === "object" && rawSignal?.confidence != null ? rawSignal.confidence : rawSignal?.confidence_score ?? null;

  async function fetchMarketOpportunities() {
    setScanError(null);
    setScanLoading(true);
    setMarketOps(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_BASE as string) || (process.env.NEXT_PUBLIC_API_URL as string) || "http://localhost:8000";
      const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${base}/insights/opportunities?limit=10`, { headers, credentials: token ? undefined : "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      // response shape: { opportunities: [...] } or array
      const list = Array.isArray(json) ? json : json?.opportunities ?? [];
      setMarketOps(list);
    } catch (e: any) {
      setScanError(e?.message || String(e));
    } finally {
      setScanLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 rounded-lg p-4 w-[95%] max-w-5xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-y-auto max-h-[82vh] insights-scroll px-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold">{symbol} — Analysis</div>
              {signalType ? (
                <div
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    signalType === "BUY" ? "bg-emerald-600 text-white" : signalType === "SELL" ? "bg-rose-600 text-white" : "bg-zinc-700 text-zinc-200"
                  }`}
                >
                  {signalType}{signalConfidence != null ? ` • ${typeof signalConfidence === 'number' && signalConfidence <= 1 ? Math.round(signalConfidence * 100) : signalConfidence}%` : ""}
                </div>
              ) : null}
            </div>
            <div className="text-sm text-zinc-400">Deep insights: technical indicators and sentiment</div>
            {error === "not_found" && (
              <div className="text-xs text-amber-300 mt-1">No insights available for this symbol.</div>
            )}
            {(data as any)?.signal?.reasoning ? (
              <div className="text-xs text-zinc-300 mt-1">{(data as any).signal.reasoning}</div>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1 bg-zinc-800 rounded-md text-sm">Close</button>
              <button onClick={() => refresh()} className="px-3 py-1 bg-blue-600 rounded-md text-sm">Retry</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-2">
            <div style={{ height: 360 }}>
              <CandlestickChart symbol={symbol} interval="1m" limit={500} height={340} />
            </div>

            <div className="mt-4">
              <Card className="bg-zinc-900/20 border-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-base">Technical Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : error === "not_found" ? (
                    <div className="text-sm text-zinc-400">No technical indicators available.</div>
                  ) : (data as any)?.technical_analysis ? (
                    <div className="text-sm space-y-2">
                      {(() => {
                        const ta = (data as any).technical_analysis ?? {};
                        const shown = new Set(["rsi", "rsi_signal", "macd", "macd_interpretation", "bollinger_position", "sma_20", "sma_50"]);
                        return (
                          <>
                            <div>RSI: <strong>{ta.rsi}</strong> — <span className="text-zinc-400">{ta.rsi_signal}</span></div>
                            <div>MACD: <strong>{(ta.macd ?? 0).toFixed ? (ta.macd ?? 0).toFixed(2) : String(ta.macd ?? 0)}</strong> — <span className="text-zinc-400">{ta.macd_interpretation}</span></div>
                            <div>Bollinger: <strong>{ta.bollinger_position}</strong></div>
                            <div className="text-xs text-zinc-500">SMA20: {ta.sma_20} • SMA50: {ta.sma_50}</div>
                            {Object.entries(ta).filter(([k]) => !shown.has(k)).map(([k, v]) => (
                              <div key={k} className="text-xs text-zinc-400">{k}: {typeof v === 'number' ? (v.toFixed ? v.toFixed(2) : String(v)) : String(v)}</div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  ) : data?.technical ? (
                    <ul className="text-sm list-disc pl-4">
                      {data.technical.map((t: any) => (
                        <li key={t.name || t.id}>{t.name}: {t.value} — {t.interpretation ?? ""}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-zinc-400">No technical data.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <Card className="bg-zinc-900/20 border-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-base">Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : error === "not_found" ? (
                    <div className="text-sm text-zinc-400">No sentiment data.</div>
                  ) : data?.sentiment ? (
                    <div className="text-sm space-y-2">
                      <div className="mb-1">Score: {(((data.sentiment as any).sentiment_score ?? (data.sentiment as any).score) ?? 0).toFixed(2)}</div>
                      <div className="text-xs text-zinc-400">{(data.sentiment as any).summary ?? ""}</div>
                      {(data.sentiment as any).articles && (data.sentiment as any).articles.length ? (
                        <div className="mt-2">
                          <div className="text-xs text-zinc-400 mb-1">Recent sources:</div>
                          <ul className="text-xs list-disc pl-4 space-y-1">
                            {(data.sentiment as any).articles.map((a: any, idx: number) => (
                              <li key={a.url ?? idx} className="flex flex-col">
                                <div className="font-medium">{a.title ?? a.headline ?? a.source}</div>
                                <div className="text-xs text-zinc-500">{a.source ?? ""} • {(a.published_at ? new Date(a.published_at).toLocaleString() : "")}</div>
                                <div className="mt-1"><a className="text-xs text-blue-400 underline" href={a.url} target="_blank" rel="noreferrer">Open source</a></div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-400">No sentiment data.</div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>

        </div>

        <div className="mt-3 text-xs text-zinc-500">
        <style>{`
          .insights-scroll {
            -webkit-overflow-scrolling: touch;
          }
          .insights-scroll::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          .insights-scroll::-webkit-scrollbar-track {
            background: #0f1720; /* zinc-900 */
          }
          .insights-scroll::-webkit-scrollbar-thumb {
            background-color: #334155; /* zinc-700 */
            border-radius: 9999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          .insights-scroll::-webkit-scrollbar-thumb:hover {
            background-color: #475569; /* zinc-600 */
          }
          /* Firefox */
          .insights-scroll {
            scrollbar-width: thin;
            scrollbar-color: #334155 #0f1720;
          }
        `}</style>
            <div>Endpoint: <code>{(process.env.NEXT_PUBLIC_API_BASE || "") + `/insights/signal/${symbol}`}</code></div>
            <div className="mt-1">If the server returned 404, there are no insights for this symbol. You can retry, or call the endpoint directly to debug.</div>
        </div>

      </div>
    </div>
  );
}
