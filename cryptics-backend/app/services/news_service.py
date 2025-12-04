# app/services/news_service.py
import httpx
from typing import List, Dict, Optional
from datetime import datetime
import json
from app.config import settings
from app.core.redis_cache import cache_get, cache_set

class NewsService:
    """Service to fetch cryptocurrency news from CryptoPanic API"""
    
    # FIXED: Updated to v2 API with developer plan
    BASE_URL = "https://cryptopanic.com/api/developer/v2"
    
    @staticmethod
    async def get_news(
        symbol: Optional[str] = None,
        limit: int = 20,
        filter_type: str = "hot"
    ) -> List[Dict]:
        """
        Fetch crypto news from CryptoPanic
        """
        
        # Create cache key
        cache_key = f"news:{symbol or 'all'}:{filter_type}:{limit}"
        
        # Check cache (30 minutes)
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
    
        # If CryptoPanic has recently reported quota/throttle, avoid calling it repeatedly.
        throttle_key = "cryptopanic:throttled"
        throttled = await cache_get(throttle_key)
        if throttled:
            # Return cached results if any, otherwise empty list to avoid hammering the API
            print("CryptoPanic is currently throttled; using cached news if available")
            if cached:
                return json.loads(cached)
            return []
        
        # Build API URL
        params = {
            "auth_token": settings.CRYPTOPANIC_API_KEY,
            "filter": filter_type,
            "public": "true"
        }
        
        if symbol:
            clean_symbol = symbol.replace("USDT", "").replace("USD", "").replace("BUSD", "")
            params["currencies"] = clean_symbol
        
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{NewsService.BASE_URL}/posts/",
                    params=params
                )
                
                if response.status_code != 200:
                    print(f"❌ CryptoPanic API error: {response.status_code}")
                    print(f"Response: {response.text[:500]}")
                    # If we're rate-limited or quota exceeded, set a short throttle flag to avoid repeated calls
                    try:
                        if response.status_code == 429:
                            # throttle for 1 hour by default
                            await cache_set(throttle_key, "1", expire_seconds=3600)
                            print("CryptoPanic quota exceeded — throttling further requests for 1 hour")
                    except Exception:
                        pass
                    return []
                
                data = response.json()
                results = data.get("results", [])[:limit]
                
                # Transform to our format (handle free tier limitations)
                articles = []
                for item in results:
                    # Extract source (may not be present in free tier)
                    source_obj = item.get("source")
                    if source_obj and isinstance(source_obj, dict):
                        source_name = source_obj.get("title", "CryptoPanic")
                    else:
                        # Fallback: Use kind or default
                        source_name = item.get("kind", "news").capitalize()
                    
                    # Extract URL (construct from slug if not present)
                    article_url = (
                        item.get("original_url") or 
                        item.get("url") or 
                        f"https://cryptopanic.com/news/{item.get('slug', '')}" if item.get('slug') else ""
                    )
                    
                    # Extract currencies/instruments
                    currencies = []
                    if "instruments" in item:
                        currencies = [c.get("code") for c in item.get("instruments", [])]
                    elif "currencies" in item:
                        currencies = [c.get("code") for c in item.get("currencies", [])]
                    
                    articles.append({
                        "title": item.get("title", ""),
                        "source": source_name,
                        "published_at": item.get("published_at", datetime.utcnow().isoformat()),
                        "url": article_url,
                        "kind": item.get("kind", "news"),
                        "currencies": currencies,
                        "votes": item.get("votes", {})
                    })
                
                # Cache for 30 minutes
                if articles:
                    await cache_set(cache_key, json.dumps(articles), expire_seconds=1800)
                
                return articles
                
        except Exception as e:
            print(f"❌ Error fetching news: {e}")
            return []
    
    @staticmethod
    async def get_trending_news(limit: int = 10) -> List[Dict]:
        """Get trending crypto news (all cryptocurrencies)"""
        return await NewsService.get_news(symbol=None, limit=limit, filter_type="hot")
    
    @staticmethod
    async def get_bullish_news(symbol: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Get bullish news for a symbol or all crypto"""
        return await NewsService.get_news(symbol=symbol, limit=limit, filter_type="bullish")
    
    @staticmethod
    async def get_bearish_news(symbol: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Get bearish news for a symbol or all crypto"""
        return await NewsService.get_news(symbol=symbol, limit=limit, filter_type="bearish")    