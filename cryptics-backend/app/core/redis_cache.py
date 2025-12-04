# app/core/redis_cache.py
import redis.asyncio as aioredis
from app.config import settings

# Asynchronous Redis for caching real-time market data
redis_cache = aioredis.from_url(
    settings.REDIS_URL,
    decode_responses=True
)

async def cache_set(key: str, value: str, expire_seconds: int = None):
    await redis_cache.set(key, value, ex=expire_seconds)

async def cache_get(key: str):
    return await redis_cache.get(key)

async def cache_delete(key: str):
    await redis_cache.delete(key)

async def close_redis_cache():
    """Gracefully close connection when app shuts down"""
    await redis_cache.close()
