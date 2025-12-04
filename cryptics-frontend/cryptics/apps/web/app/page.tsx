"use client";

import { useEffect, useState } from "react";

// imports from shared packages
import { crypticsTestUtil } from "@cryptics/utils";
import { crypticsApiPing } from "@cryptics/api";

export default function Home() {
  const [wsMessage, setWsMessage] = useState<string>("Connecting…");

  useEffect(() => {
    // Simple websocket test (Echo server)
    const ws = new WebSocket("wss://echo.websocket.org");

    ws.onopen = () => {
      setWsMessage("WebSocket connected!");
      ws.send("Hello from Cryptics Web!");
    };

    ws.onmessage = (event) => {
      setWsMessage("WebSocket says: " + event.data);
    };

    ws.onerror = () => setWsMessage("WebSocket error!");
    ws.onclose = () => console.log("WS closed");

    return () => ws.close();
  }, []);

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Inter, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>
        🔥 Cryptics Web (Next.js + Turbo Monorepo)
      </h1>

      <section style={{ marginBottom: 30 }}>
        <h2>Shared Utils Test</h2>
        <pre
          style={{
            padding: 12,
            background: "#111",
            color: "lime",
            borderRadius: 6,
          }}
        >
          {crypticsTestUtil()}
        </pre>
      </section>

      <section style={{ marginBottom: 30 }}>
        <h2>Shared API Test</h2>
        <pre
          style={{
            padding: 12,
            background: "#111",
            color: "cyan",
            borderRadius: 6,
          }}
        >
          {JSON.stringify(crypticsApiPing(), null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: 30 }}>
        <h2>WebSocket Test</h2>
        <pre
          style={{
            padding: 12,
            background: "#111",
            color: "orange",
            borderRadius: 6,
          }}
        >
          {wsMessage}
        </pre>
      </section>

      <section>
        <h2>Environment Test</h2>
        <pre
          style={{
            padding: 12,
            background: "#111",
            color: "violet",
            borderRadius: 6,
          }}
        >
          NEXT_PUBLIC_ENV= {process.env.NEXT_PUBLIC_TEST ?? "Not Loaded"}
        </pre>
      </section>
    </main>
  );
}
