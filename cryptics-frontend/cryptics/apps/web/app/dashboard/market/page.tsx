"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const CandlestickChart = dynamic(() => import("../../../components/lwc/CandlestickChart"), { ssr: false });

export default function MarketPage() {
  const [interval, setInterval] = useState("1m");

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Market — BTC/USDT</h2>
        <div className="flex gap-2">
          {[
            { id: "1m", label: "1m" },
            { id: "1h", label: "1h" },
            { id: "1d", label: "1d" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setInterval(b.id)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${interval === b.id ? "bg-blue-600" : "bg-zinc-800"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-lg">
        <CandlestickChart symbol="BTCUSDT" interval={interval} height={420} />
      </div>
    </div>
  );
}
