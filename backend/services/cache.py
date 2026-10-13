"""
OrphaAI — High-Performance Redis & LRU Caching Layer
Caches top searched indications, predictions, and molecular fingerprint matrix computations
enabling sub-10ms response times for repeated queries.
"""

import os
import json
import logging
import functools
from typing import Any, Optional

logger = logging.getLogger("cache_service")

# Redis configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_redis_client = None
_memory_cache = {}
_memory_max_size = 200  # Cache top 200 searched indications in memory

try:
    import redis
    _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
    _redis_client.ping()
    logger.info(f"[Cache] Connected to Redis at {REDIS_URL}")
except Exception as e:
    _redis_client = None
    logger.info(f"[Cache] Redis unavailable ({e}). Operating in-memory LRU cache mode (max { _memory_max_size } entries).")


def get_cache(key: str) -> Optional[Any]:
    """Retrieves cached JSON payload by key from Redis or in-memory LRU cache."""
    clean_key = f"orphaai:{key}"

    if _redis_client is not None:
        try:
            data = _redis_client.get(clean_key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"[Cache] Redis read error: {e}")

    # Fallback to in-memory dictionary cache
    if clean_key in _memory_cache:
        return _memory_cache[clean_key]

    return None


def set_cache(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """Stores payload in Redis or in-memory dictionary cache."""
    clean_key = f"orphaai:{key}"
    json_val = json.dumps(value)

    if _redis_client is not None:
        try:
            _redis_client.setex(clean_key, ttl_seconds, json_val)
            return True
        except Exception as e:
            logger.warning(f"[Cache] Redis write error: {e}")

    # Fallback to in-memory dictionary cache with LRU eviction
    if len(_memory_cache) >= _memory_max_size:
        oldest_key = next(iter(_memory_cache))
        _memory_cache.pop(oldest_key, None)

    _memory_cache[clean_key] = value
    return True


def cache_indication_query(ttl_seconds: int = 3600):
    """Decorator to cache indication prediction and cheminformatics analysis routes."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            disease = kwargs.get("disease") or (args[0] if args else "")
            if disease:
                cache_key = f"query:{str(disease).strip().lower()}"
                cached_data = get_cache(cache_key)
                if cached_data is not None:
                    cached_data["_cached"] = True
                    return cached_data

            result = func(*args, **kwargs)

            if disease and result:
                cache_key = f"query:{str(disease).strip().lower()}"
                set_cache(cache_key, result, ttl_seconds=ttl_seconds)

            return result
        return wrapper
    return decorator
