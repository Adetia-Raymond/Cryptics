"use client";

import { useEffect, useRef, useState } from "react";

export type MarketMessage = any;

export function useMarketWS(symbol: string, streamType: string = "ticker") {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MarketMessage | null>(null);

  useEffect(() => {
    if (!symbol) return;

    // Prefer explicit backend host if provided via NEXT_PUBLIC_API_URL
    // e.g. NEXT_PUBLIC_API_URL=http://localhost:8000
    const publicApi = (process.env.NEXT_PUBLIC_API_URL as string) || "";

    let baseHost: string;
    let protocol: string;

    if (publicApi) {
      try {
        const u = new URL(publicApi);
        protocol = u.protocol === "https:" ? "wss" : "ws";
        baseHost = u.host;
      } catch (e) {
        // fallback to window host
        protocol = window.location.protocol === "https:" ? "wss" : "ws";
        baseHost = window.location.host;
      }
    } else {
      protocol = window.location.protocol === "https:" ? "wss" : "ws";
      baseHost = window.location.host;
    }

    const url = `${protocol}://${baseHost}/market/ws?symbol=${encodeURIComponent(symbol)}&stream_type=${encodeURIComponent(
      streamType
    )}`;

    let mounted = true;
    let reconnectTimer: number | null = null;

    function connect() {
      try {
        wsRef.current = new WebSocket(url);
        wsRef.current.onopen = () => {
          if (!mounted) return;
          setConnected(true);
        };
        wsRef.current.onmessage = (ev) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(ev.data);
            setLastMessage(data);
          } catch (e) {
            setLastMessage(ev.data as any);
          }
        };
        wsRef.current.onclose = () => {
          if (!mounted) return;
          setConnected(false);
          // reconnect with backoff
          reconnectTimer = window.setTimeout(connect, 2000);
        };
        wsRef.current.onerror = () => {
          // will trigger close
        };
      } catch (e) {
        reconnectTimer = window.setTimeout(connect, 2000);
      }
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, [symbol, streamType]);

  const send = (data: any) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
    } catch (e) {}
  };

  return { connected, lastMessage, send, ws: wsRef.current } as const;
}
