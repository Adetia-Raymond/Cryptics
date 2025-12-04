# app/services/binance_service.py
import httpx
from typing import Optional, Dict
from app.core.redis_cache import cache_get, cache_set
import json

BINANCE_BASE_URL = "https://api.binance.com/api/v3"

class BinanceService:
    """Helper service for Binance API calls with caching"""
    
    @staticmethod
    async def get_price(symbol: str) -> Optional[Dict]:
        """Get current price for a symbol (cached 5s)"""
        cache_key = f"price:{symbol.upper()}"
        
        # Check cache
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Fetch from Binance
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BINANCE_BASE_URL}/ticker/price",
                    params={"symbol": symbol.upper()}
                )
                if response.status_code == 200:
                    data = response.json()
                    await cache_set(cache_key, json.dumps(data), expire_seconds=5)
                    return data
        except:
            pass
        
        return None
    
    @staticmethod
    async def get_24h_ticker(symbol: str) -> Optional[Dict]:
        """Get 24h ticker data (cached 10s)"""
        cache_key = f"ticker:{symbol.upper()}"
        
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BINANCE_BASE_URL}/ticker/24hr",
                    params={"symbol": symbol.upper()}
                )
                if response.status_code == 200:
                    data = response.json()
                    await cache_set(cache_key, json.dumps(data), expire_seconds=10)
                    return data
        except:
            pass
        
        return None
    
    @staticmethod
    async def get_symbol_info(symbol: str) -> Optional[Dict]:
        """Verify symbol exists on Binance (cached 1 hour)"""
        cache_key = f"symbol_info:{symbol.upper()}"
        
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{BINANCE_BASE_URL}/exchangeInfo")
                if response.status_code == 200:
                    data = response.json()
                    for s in data.get("symbols", []):
                        if s["symbol"] == symbol.upper():
                            await cache_set(cache_key, json.dumps(s), expire_seconds=3600)
                            return s
        except:
            pass
        
        return None