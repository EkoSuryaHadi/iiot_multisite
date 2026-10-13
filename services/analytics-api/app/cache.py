import threading
from typing import Any, Callable

from cachetools import TTLCache

from app.config import settings


class LockedTTLCache:
    """TTLCache thread-safe, dipakai untuk cache resolusi tenant_id -> tenant_slug
    agar tidak query Postgres di setiap request query analytics."""

    def __init__(self, maxsize: int, ttl: int) -> None:
        self._cache: TTLCache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = threading.Lock()

    def get_or_set(self, key: Any, loader: Callable[[], Any]) -> Any:
        with self._lock:
            if key in self._cache:
                return self._cache[key]
        value = loader()
        with self._lock:
            self._cache[key] = value
        return value

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


tenant_slug_cache = LockedTTLCache(maxsize=10_000, ttl=settings.tenant_cache_ttl_seconds)
