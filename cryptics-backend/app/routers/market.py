# app/routers/market.py

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
import httpx
from typing import Optional, List
from app.core.redis_cache import cache_get, cache_set
import json
import websockets
import time


router = APIRouter(prefix="/market", tags=["Market"])

# Base URL for Binance Public Market Data
BINANCE_BASE_URL = "https://api.binance.com/api/v3"

# ============================
# Health Check Endpoint 
# ============================
async def ping_binance() -> bool:
    """Ping Binance API to check availability"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BINANCE_BASE_URL}/ping", timeout=5)
            return response.status_code == 200
    except httpx.RequestError:
        return False

async def redis_ping() -> bool:
    """Ping Redis to check availability"""
    try:
        cached = await cache_get("ping_test")
        if cached is None:
            await cache_set("ping_test", "pong", expire_seconds=10)
        return True
    except Exception:
        return False

@router.get("/ping")
async def ping():
    return {
        "binance_status": "ok" if await ping_binance() else "unreachable",
        "redis_status": "ok" if await redis_ping() else "unreachable"
    }

# ============================
# 1️⃣ Get Current Price (Updated with Caching)
# ============================
@router.get("/price")
async def get_price(symbol: Optional[str] = Query(None, description="Trading pair, e.g. BTCUSDT")):
    """
    Get the latest price for a given symbol (e.g. BTCUSDT).
    If no symbol is provided, returns prices for all symbols.
    Fetches from Binance, caches in Redis for 5s.
    """
    endpoint = f"{BINANCE_BASE_URL}/ticker/price"
    try:
        cache_key = f"price:{symbol}" if symbol else "price:all"

        # 1️⃣ Check Redis cache
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        # 2️⃣ Fetch from Binance
        async with httpx.AsyncClient() as client:
            response = await client.get(endpoint, params={"symbol": symbol} if symbol else {})
            response.raise_for_status()
            data = response.json()

        # 3️⃣ Cache result for 5 seconds
        await cache_set(cache_key, json.dumps(data), expire_seconds=5)
        return {"symbol": symbol.upper() if symbol else "ALL", "price_data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# 2️⃣ 24hr Ticker Summary (Without Caching)
# ============================
@router.get("/summary")
async def get_24hr_summary(symbol: str = Query(..., description="Trading pair, e.g. BTCUSDT")):
    """
    Returns 24hr price summary for a given symbol.
    """
    endpoint = f"{BINANCE_BASE_URL}/ticker/24hr"
    params = {"symbol": symbol}

    cache_key = f"summary24:{symbol.lower()}"
    try:
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        cached = None

    async with httpx.AsyncClient() as client:
        response = await client.get(endpoint, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    try:
        await cache_set(cache_key, json.dumps(data), expire_seconds=5)
    except Exception:
        pass

    return data


# ============================
# 6️⃣ Batched Summaries Endpoint
# ============================
@router.get("/summaries")
async def get_summaries(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols, e.g. BTCUSDT,ETHUSDT"),
    limit: int = Query(100, description="Max number of summaries to return when requesting all"),
    include_klines: Optional[bool] = Query(False, description="Include recent klines for requested symbols"),
    kline_interval: Optional[str] = Query("1m", description="Kline interval when including klines"),
    kline_limit: Optional[int] = Query(48, description="Number of klines to include per symbol when including klines")
):
    """
    Returns lightweight summaries for many symbols. If `symbols` is provided (comma-separated), returns only those.
    Otherwise returns up to `limit` top summaries (by volume as returned by Binance).
    Summaries are cached for a short time to avoid hitting Binance too frequently.
    """
    try:
        # helper to normalize a raw 24hr ticker response into our summary shape
        def _to_summary(d: dict):
            """Normalize Binance 24hr ticker object into a lightweight but richer summary.

            The goal is to keep the object compact but include fields commonly used
            by the frontend (last price, change, percent change, high/low/open, volume,
            and optionally bid/ask/lastQty) so the batched `/summaries` response is
            more useful and closer to the single-symbol `/summary` payload.
            """
            sym = d.get("symbol") or d.get("s")

            # common price/value fields (try several possible key names)
            def _get(dct, *keys):
                for k in keys:
                    v = dct.get(k)
                    if v is not None:
                        return v
                return None

            last = _get(d, "lastPrice", "c", "price", "p")
            price_change = _get(d, "priceChange", "priceChange24h", "p")
            price_change_pct = _get(d, "priceChangePercent", "P")
            vol = _get(d, "volume", "v")
            high = _get(d, "highPrice", "h")
            low = _get(d, "lowPrice", "l")
            open_price = _get(d, "openPrice", "o")
            last_qty = _get(d, "lastQty")
            bid_price = _get(d, "bidPrice")
            ask_price = _get(d, "askPrice")

            def _float(v):
                try:
                    return float(v) if v is not None else None
                except Exception:
                    return None

            last_f = _float(last)
            vol_f = _float(vol)
            high_f = _float(high)
            low_f = _float(low)
            open_f = _float(open_price)
            change_f = _float(price_change)

            # priceChangePercent is often a string like "0.365" — keep as string for consistent display
            change_pct = price_change_pct if price_change_pct is not None else None

            out = {
                "symbol": sym,
                "last_price": last_f,
                "price_change": change_f,
                "price_change_percent": change_pct,
                "change_pct_24h": change_pct,
                "high_price": high_f,
                "low_price": low_f,
                "open_price": open_f,
                "volume": vol_f,
            }

            # include a few optional small fields if present (useful for UI details)
            if last_qty is not None:
                out["last_qty"] = last_qty
            if bid_price is not None:
                out["bid_price"] = _float(bid_price)
            if ask_price is not None:
                out["ask_price"] = _float(ask_price)

            return out

        # if symbols specified, fetch individually (use cache)
        if symbols:
            parts = [s.strip().upper() for s in symbols.split(",") if s.strip()]
            out = []
            # Attempt to fetch the full 24hr ticker list once and filter locally to avoid N HTTP calls
            all_cache_key = f"ticker24hr:all"
            cached_all = await cache_get(all_cache_key)
            data = None
            async with httpx.AsyncClient() as client:
                if cached_all:
                    try:
                        data = json.loads(cached_all)
                    except Exception:
                        data = None

                if data is None:
                    try:
                        resp = await client.get(f"{BINANCE_BASE_URL}/ticker/24hr")
                        resp.raise_for_status()
                        data = resp.json()
                        try:
                            await cache_set(all_cache_key, json.dumps(data), expire_seconds=5)
                        except Exception:
                            pass
                    except Exception:
                        data = None

                # Build index for quick lookup
                index = {}
                if isinstance(data, list):
                    for d in data:
                        sym = (d.get("symbol") or d.get("s") or "").upper()
                        if sym:
                            index[sym] = d

                for sym in parts:
                    cache_key = f"summary:{sym.lower()}"
                    # prefer the short-lived cached summary
                    cached = await cache_get(cache_key)
                    if cached:
                        try:
                            parsed_cached = json.loads(cached)
                            # If the cached summary already contains the richer 24hr fields (open/high/low/etc), use it.
                            if isinstance(parsed_cached, dict) and (parsed_cached.get("open_price") is not None or parsed_cached.get("high_price") is not None or parsed_cached.get("price_change") is not None):
                                out.append(parsed_cached)
                                continue
                            # Otherwise, attempt to enrich by fetching the single-symbol 24hr ticker
                            try:
                                resp = await client.get(f"{BINANCE_BASE_URL}/ticker/24hr", params={"symbol": sym}, timeout=6.0)
                                if resp.status_code == 200:
                                    d2 = resp.json()
                                    s2 = _to_summary(d2)
                                    if s2.get("last_price") is not None or s2.get("open_price") is not None:
                                        out.append(s2)
                                        try:
                                            await cache_set(cache_key, json.dumps(s2), expire_seconds=5)
                                        except Exception:
                                            pass
                                        continue
                            except Exception:
                                # fall back to the minimal cached summary below
                                pass

                            # fallback: use the cached minimal summary (from websocket) if enrichment failed
                            out.append(parsed_cached)
                            continue
                        except Exception:
                            pass
                    d = index.get(sym.upper()) if index else None
                    if d:
                        s = _to_summary(d)
                        # Optionally attach recent klines (cached) when requested by client
                        if include_klines:
                            try:
                                k_cache = f"klines:{sym.lower()}:{kline_interval}:{kline_limit}"
                                kcached = await cache_get(k_cache)
                                if kcached:
                                    s['klines'] = json.loads(kcached)
                                else:
                                    try:
                                        resp = await client.get(f"{BINANCE_BASE_URL}/klines", params={"symbol": sym, "interval": kline_interval, "limit": kline_limit}, timeout=6.0)
                                        if resp.status_code == 200:
                                            raw_klines = resp.json()
                                            formatted = [
                                                {
                                                    "open_time": k[0],
                                                    "open": float(k[1]),
                                                    "high": float(k[2]),
                                                    "low": float(k[3]),
                                                    "close": float(k[4]),
                                                    "volume": float(k[5]),
                                                    "close_time": k[6]
                                                }
                                                for k in raw_klines
                                            ]
                                            s['klines'] = formatted
                                            try:
                                                await cache_set(k_cache, json.dumps(formatted), expire_seconds=5)
                                            except Exception:
                                                pass
                                    except Exception:
                                        pass
                            except Exception:
                                pass
                        # Defensive fallback: if critical fields are missing, try a single-symbol request
                        if (s.get("last_price") is None) or (s.get("open_price") is None):
                            try:
                                # attempt single-symbol fetch as last resort
                                resp = await client.get(f"{BINANCE_BASE_URL}/ticker/24hr", params={"symbol": sym}, timeout=6.0)
                                if resp.status_code == 200:
                                    d2 = resp.json()
                                    s2 = _to_summary(d2)
                                    # if the single-symbol response yields more complete data, use it
                                    if s2.get("last_price") is not None or s2.get("open_price") is not None:
                                        s = s2
                                        try:
                                            await cache_set(cache_key, json.dumps(s), expire_seconds=5)
                                        except Exception:
                                            pass
                            except Exception:
                                # swallow and continue with whatever we had
                                pass
                        out.append(s)
                        try:
                            # ensure we cache the normalized shape for faster subsequent calls
                            await cache_set(cache_key, json.dumps(s), expire_seconds=5)
                        except Exception:
                            pass
                    else:
                        # fallback: try a single-symbol request as a last resort (keeps behavior but avoids doing this for every symbol)
                        try:
                            resp = await client.get(f"{BINANCE_BASE_URL}/ticker/24hr", params={"symbol": sym})
                            if resp.status_code == 200:
                                d2 = resp.json()
                                s2 = _to_summary(d2)
                                out.append(s2)
                                try:
                                    await cache_set(cache_key, json.dumps(s2), expire_seconds=5)
                                except Exception:
                                    pass
                        except Exception:
                            # ignore and continue
                            pass

            return {"count": len(out), "summaries": out}

        # otherwise, return top `limit` summaries (cached)
        all_cache_key = f"summaries:all:{limit}"
        cached_all = await cache_get(all_cache_key)
        if cached_all:
            return json.loads(cached_all)

        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BINANCE_BASE_URL}/ticker/24hr")
            resp.raise_for_status()
            data = resp.json()

        # convert and sort by volume (desc) and take top `limit`
        summaries = [_to_summary(d) for d in data]
        try:
            summaries_sorted = sorted(summaries, key=lambda x: x.get("volume") or 0, reverse=True)
        except Exception:
            summaries_sorted = summaries

        out = summaries_sorted[:limit]
        try:
            await cache_set(all_cache_key, json.dumps({"count": len(out), "summaries": out}), expire_seconds=5)
        except:
            pass

        return {"count": len(out), "summaries": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# 3️⃣ Candlestick (Klines) (Without Caching)
# ============================
@router.get("/klines")
async def get_klines(
    symbol: str = Query(..., description="Trading pair, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Interval (e.g. 1m, 5m, 1h, 1d)"),
    limit: int = Query(100, le=1000, description="Number of candles to return (max 1000)")
):
    """
    Returns OHLCV (candlestick) data.
    """
    endpoint = f"{BINANCE_BASE_URL}/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}

    cache_key = f"klines:{symbol.lower()}:{interval}:{limit}"
    try:
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        cached = None

    async with httpx.AsyncClient() as client:
        response = await client.get(endpoint, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    raw_klines = response.json()

    # Transform to structured JSON for frontend
    formatted = [
        {
            "open_time": k[0],
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
            "close_time": k[6]
        }
        for k in raw_klines
    ]

    try:
        await cache_set(cache_key, json.dumps(formatted), expire_seconds=5)
    except Exception:
        pass

    return formatted


# ============================
# 4️⃣ Exchange Info (Without Caching)
# ============================
@router.get("/exchangeInfo")
async def get_exchange_info():
    """
    Returns metadata about all available symbols.
    """
    endpoint = f"{BINANCE_BASE_URL}/exchangeInfo"

    async with httpx.AsyncClient() as client:
        response = await client.get(endpoint)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()












# ====================================================================================
# 5️⃣ WebSocket BROADCAST SYSTEM (Single Binance Connection → Many Clients)
# ====================================================================================

import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
import websockets

BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws"

# Shared dictionary for all clients
# Key format: "ticker:btcusdt"
connected_clients = {}

# summary subscribers: symbol -> [WebSocket]
summary_clients = {}

# Background tasks keyed by stream key
background_tasks = {}

def make_task_key(stream_type: str, symbol: str):
    return f"task:{stream_type}:{symbol}"

def make_key(stream_type: str, symbol: str):
    return f"{stream_type}:{symbol}"

async def register_client(websocket: WebSocket, stream_type: str, symbol: str):
    key = make_key(stream_type, symbol)

    if key not in connected_clients:
        connected_clients[key] = []

    connected_clients[key].append(websocket)
    # ensure a background task is running for this stream+symbol
    task_key = make_task_key(stream_type, symbol)
    if task_key not in background_tasks:
        background_tasks[task_key] = asyncio.create_task(binance_stream_task(stream_type, symbol))

async def unregister_client(websocket: WebSocket, stream_type: str, symbol: str):
    key = make_key(stream_type, symbol)

    if key in connected_clients:
        connected_clients[key].remove(websocket)
        if not connected_clients[key]:
            del connected_clients[key]
            # cancel background task if no clients remain for this stream+symbol
            task_key = make_task_key(stream_type, symbol)
            t = background_tasks.get(task_key)
            if t:
                try:
                    t.cancel()
                except:
                    pass
                background_tasks.pop(task_key, None)


async def register_summary_client(websocket: WebSocket, symbol: str):
    key = symbol.lower()
    if key not in summary_clients:
        summary_clients[key] = []
    summary_clients[key].append(websocket)


async def unregister_summary_client(websocket: WebSocket, symbol: str):
    key = symbol.lower()
    if key in summary_clients:
        try:
            summary_clients[key].remove(websocket)
        except ValueError:
            pass
        if not summary_clients[key]:
            summary_clients.pop(key, None)


# ============================================================
# 🔄  Background Task: Stream from Binance Once (per type)
# ============================================================

STREAMS = {
    "ticker": "!ticker@arr",
    "trades": "!trade@arr",
    "depth": "!depth5@arr"
}

async def binance_stream_task(stream_type: str, symbol: str):
    """
    Background task that connects to Binance for a specific symbol and stream_type
    and forwards messages to all registered WebSocket clients for that key.
    Example stream_type: 'kline_1m', 'trades', 'ticker'
    """
    stream_name = f"{symbol.lower()}@{stream_type.lower()}"
    url = f"{BINANCE_WS_BASE}/{stream_name}"
    print(f"📡 Starting Binance stream task: {url}")

    key = make_key(stream_type, symbol.lower())
    task_key = make_task_key(stream_type, symbol.lower())

    while True:
        try:
            async with websockets.connect(url, ping_interval=None) as ws:
                async for raw_msg in ws:
                    try:
                        data = json.loads(raw_msg)
                    except Exception:
                        data = raw_msg

                    # forward raw data to exact-stream subscribers
                    if key in connected_clients:
                        for client_ws in list(connected_clients[key]):
                            try:
                                await client_ws.send_text(json.dumps(data))
                            except Exception:
                                pass

                    # Also build and broadcast a lightweight summary to summary subscribers
                    try:
                        sym = None
                        last_price = None
                        vol = None
                        ts = int(time.time() * 1000)

                        if isinstance(data, dict):
                            # kline message
                            if "k" in data and isinstance(data.get("k"), dict):
                                k = data.get("k")
                                sym = data.get("s") or k.get("s")
                                last_price = float(k.get("c")) if k.get("c") is not None else None
                                vol = float(k.get("v")) if k.get("v") is not None else None
                            else:
                                # ticker-like message
                                sym = data.get("s")
                                if data.get("c") is not None:
                                    try:
                                        last_price = float(data.get("c"))
                                    except:
                                        last_price = None
                                elif data.get("p") is not None:
                                    # price change, not absolute price
                                    last_price = None

                        if sym:
                            summary = {
                                "symbol": sym,
                                "last_price": last_price,
                                "volume": vol,
                                "ts": ts,
                            }

                            # cache short-lived summary
                            try:
                                await cache_set(f"summary:{sym.lower()}", json.dumps(summary), expire_seconds=5)
                            except Exception:
                                pass

                            # broadcast to any summary subscribers for this symbol
                            sk = sym.lower()
                            if sk in summary_clients:
                                for client_ws in list(summary_clients[sk]):
                                    try:
                                        await client_ws.send_text(json.dumps({"type": "summary", "data": summary}))
                                    except Exception:
                                        pass
                    except Exception:
                        # be defensive: don't allow summary broadcast failures to stop the stream
                        pass

        except asyncio.CancelledError:
            print(f"🛑 Cancelled Binance stream task: {stream_name}")
            break
        except Exception as e:
            print(f"❌ Binance stream task error ({stream_name}):", e)
            await asyncio.sleep(3)

    # cleanup on exit
    background_tasks.pop(task_key, None)


# ============================================================
# 🔌 WebSocket Endpoint for Clients
# ============================================================
@router.websocket("/ws")
async def market_ws(websocket: WebSocket, symbol: str = "btcusdt", stream_type: str = "ticker"):
    await websocket.accept()

    # register client into the broadcast system
    await register_client(websocket, stream_type, symbol.lower())

    try:
        # keep connection open until client disconnects; receive_text will block until client sends or disconnects
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        # client disconnected
        await unregister_client(websocket, stream_type, symbol.lower())
        print(f"Client disconnected: {symbol}@{stream_type}")
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except:
            pass
        await unregister_client(websocket, stream_type, symbol.lower())
        await websocket.close()


@router.websocket("/ws/summaries")
async def market_summaries_ws(websocket: WebSocket, symbols: str = "BTCUSDT"):
    """WebSocket endpoint for lightweight summary subscriptions.
    Query param `symbols` is a comma-separated list of symbols.
    Clients will receive messages of shape { type: 'summary', data: { symbol, last_price, volume, ts } }
    """
    await websocket.accept()

    parsed: List[str] = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    # register initial subscriptions
    for s in parsed:
        await register_summary_client(websocket, s)

    try:
        while True:
            # receive client messages to subscribe/unsubscribe dynamically
            msg_text = await websocket.receive_text()
            try:
                msg = json.loads(msg_text)
              
                action = msg.get("action")
                if action == "subscribe":
                    arr = msg.get("symbols") or []
                    for s in arr:
                        if not s: continue
                        await register_summary_client(websocket, s.upper())
                        # if we have a cached summary, send it immediately
                        try:
                            cached = await cache_get(f"summary:{s.lower()}")
                            if cached:
                                await websocket.send_text(json.dumps({"type": "summary", "data": json.loads(cached)}))
                        except Exception:
                            pass

                elif action == "unsubscribe":
                    arr = msg.get("symbols") or []
                    for s in arr:
                        if not s: continue
                        await unregister_summary_client(websocket, s.upper())

                elif action == "replace":
                    # replace subscriptions with provided list
                    arr = msg.get("symbols") or []
                    # unregister all current for this websocket
                    # we don't track reverse mapping, so best-effort: unregister parsed and arr complement
                    # For simplicity, unregister parsed initial list and re-register arr
                    for s in parsed:
                        await unregister_summary_client(websocket, s)
                    parsed = [s.strip().upper() for s in arr if s]
                    for s in parsed:
                        await register_summary_client(websocket, s)

                else:
                    # ignore unknown actions or pings
                    pass
            except json.JSONDecodeError:
                # ignore non-json messages (could be ping)
                continue
    except WebSocketDisconnect:
        for s in parsed:
            await unregister_summary_client(websocket, s)
    except Exception:
        for s in parsed:
            await unregister_summary_client(websocket, s)
        try:
            await websocket.close()
        except:
            pass


# # To test WebSocket:
# npx wscat -c "ws://localhost:8000/market/ws?symbol=btcusdt&stream_type=ticker"
# npx wscat -c "ws://localhost:8000/market/ws?symbol=btcusdt&stream_type=kline_1m"
# Example message received:
# { "e": "24hrTicker", "E": 1697041234567, "s": "BTCUSDT", "p": "500.00", ... }
# ====================================================================================
# End of file app/routers/market.py

