import asyncio
import logging

from app.clickhouse_client import get_client
from app.config import settings

logger = logging.getLogger("ingest-buffer")


class AsyncBatchBuffer:
    """Buffer in-memory sederhana untuk batching insert ke ClickHouse.

    Flush terjadi saat (a) jumlah baris >= batch_size, atau (b) timer periodik
    flush_interval_seconds lewat - mana dulu yang tercapai. Ini mengurangi jumlah
    INSERT statement ke ClickHouse dibanding insert 1 baris per request HTTP
    dari EMQX Rule Engine.
    """

    def __init__(self, table: str, column_names: list[str], batch_size: int, flush_interval: float) -> None:
        self._table = table
        self._column_names = column_names
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._rows: list[tuple] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None

    async def add(self, row: tuple) -> None:
        should_flush = False
        async with self._lock:
            self._rows.append(row)
            if len(self._rows) >= self._batch_size:
                should_flush = True
        if should_flush:
            await self.flush()

    async def flush(self) -> int:
        async with self._lock:
            if not self._rows:
                return 0
            rows_to_insert = self._rows
            self._rows = []

        try:
            await asyncio.to_thread(self._insert, rows_to_insert)
        except Exception:
            logger.exception("Gagal insert batch ke tabel %s, %d baris dibuang", self._table, len(rows_to_insert))
            return 0
        return len(rows_to_insert)

    def _insert(self, rows: list[tuple]) -> None:
        client = get_client()
        client.insert(self._table, rows, column_names=self._column_names)

    async def _periodic_flush(self) -> None:
        while True:
            await asyncio.sleep(self._flush_interval)
            await self.flush()

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._periodic_flush())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None
        await self.flush()

    async def clear(self) -> None:
        """Buang semua baris yang belum di-flush tanpa insert (dipakai di test)."""
        async with self._lock:
            self._rows = []


telemetry_buffer = AsyncBatchBuffer(
    table="telemetry",
    column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
)

device_status_buffer = AsyncBatchBuffer(
    table="device_status",
    column_names=["tenant_slug", "site_slug", "device_key", "status", "ts", "raw_payload"],
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
)
