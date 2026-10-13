import threading
from typing import Any, Callable

from cachetools import TTLCache

from app.config import settings


class LockedTTLCache:
    """TTLCache yang thread-safe, dipakai untuk mengurangi beban query Postgres
    saat EMQX memanggil /authn & /authz untuk tiap koneksi/publish/subscribe.
    """

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

    def invalidate(self, key: Any) -> None:
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


authn_cache = LockedTTLCache(maxsize=settings.cache_max_size, ttl=settings.cache_ttl_seconds)
authz_cache = LockedTTLCache(maxsize=settings.cache_max_size, ttl=settings.cache_ttl_seconds)
