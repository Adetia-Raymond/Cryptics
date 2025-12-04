# app/core/redis_auth.py
import redis
from app.config import settings

# Synchronous client for simple token checks
redis_auth = redis.StrictRedis.from_url(
    settings.REDIS_URL,
    decode_responses=True  # return strings instead of bytes
)

# Helper functions for JWT/session use
def blacklist_token(token: str, expire_seconds: int):
    redis_auth.set(f"blacklist:{token}", "true", ex=expire_seconds)

def is_token_blacklisted(token: str) -> bool:
    return redis_auth.get(f"blacklist:{token}") == "true"

def redis_set(key: str, value: str, expire_seconds: int = None):
    redis_auth.set(key, value, ex=expire_seconds)

def redis_get(key: str):
    return redis_auth.get(key)

def redis_delete(key: str):
    redis_auth.delete(key)
