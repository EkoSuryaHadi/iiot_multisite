import asyncio
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path

from app.config import settings

logger = logging.getLogger("ingest-buffer")


class AsyncBatchBuffer:
    """Buffer batch insert ke ClickHouse dengan spool disk + backoff.

    Alur (v2, perbaikan atas v1 in-memory):
      add()  -> antrean memori -> flush saat batch penuh / timer periodik
      flush() sukses -> drain spool (data lama dikirim lebih dulu)
      flush() gagal  -> baris DITULIS KE DISK (jsonl di volume persisten),
                        lalu backoff eksponensial (2^n x interval, plafon
                        backoff_max_seconds) supaya tidak retry-storm.

    v1 (in-memory murni) membuang baris terlama saat antrean penuh — penyebab
    data bolong 25 Okt, 30 Okt-1 Nov, 3-4 Nov 2026. v2 tidak membuang:
    data mengalir ke disk dan di-replay saat ClickHouse pulih.
    Insert tetap lewat writer thread tunggal + insert_rows() (cache skema).
    """

    def __init__(
        self,
        table: str,
        column_names: list[str],
        batch_size: int,
        flush_interval: float,
        max_buffered_rows: int = 100_000,
        spool_dir: str | None = None,
        spool_max_bytes: int = 512 * 1024 * 1024,
        backoff_max_seconds: float = 60.0,
        ts_index: int | None = None,
    ) -> None:
        self._table = table
        self._column_names = column_names
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._max_buffered_rows = max_buffered_rows
        self._spool_dir = Path(spool_dir) if spool_dir else None
        self._spool_max_bytes = spool_max_bytes
        self._backoff_max = backoff_max_seconds
        self._ts_index = ts_index  # posisi kolom ts utk revive saat replay

        self._rows: list[tuple] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._fails = 0
        self._next_try_at = 0.0

        if self._spool_dir:
            try:
                self._spool_dir.mkdir(parents=True, exist_ok=True)
            except Exception:  # noqa: BLE001
                logger.exception("gagal membuat spool_dir %s — spool nonaktif", self._spool_dir)
                self._spool_dir = None

    # ---------- public ----------

    async def add(self, row: tuple) -> None:
        should_flush = False
        async with self._lock:
            self._rows.append(row)
            if len(self._rows) >= self._batch_size:
                should_flush = True
        if should_flush:
            await self.flush()

    async def flush(self) -> int:
        loop = asyncio.get_running_loop()
        if loop.time() < self._next_try_at:
            return 0  # masih dalam masa backoff

        async with self._lock:
            rows, self._rows = self._rows, []
        inserted = 0

        if rows:
            ok = await loop.run_in_executor(self._executor(), self._try_insert, rows)
            if ok:
                inserted += len(rows)
                self._fails = 0
                self._next_try_at = 0.0
            else:
                await loop.run_in_executor(self._executor(), self._spool_append, rows)
                self._bump_backoff()
                return 0

        if self._spool_dir:
            inserted += await loop.run_in_executor(self._executor(), self._drain_spool)
        return inserted

    async def _periodic_flush(self) -> None:
        while True:
            await asyncio.sleep(self._flush_interval)
            try:
                await self.flush()
            except Exception:  # jangan sampai task mati
                logger.exception("flush periodik %s gagal", self._table)

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._periodic_flush())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None
        if self._rows:
            await asyncio.to_thread(self._spool_append, self._rows)
            self._rows = []

    async def clear(self) -> None:
        """Buang baris di RAM yang belum di-flush (dipakai di test)."""
        async with self._lock:
            self._rows = []

    # ---------- internal ----------

    def _executor(self):
        from app.clickhouse_client import get_writer_executor

        return get_writer_executor()

    def _bump_backoff(self) -> None:
        self._fails += 1
        delay = min(self._flush_interval * (2 ** self._fails), self._backoff_max)
        self._next_try_at = time.monotonic() + delay
        logger.warning(
            "insert %s gagal %dx, backoff %.0fs (data aman di spool disk)",
            self._table, self._fails, delay,
        )

    def _spool_path(self) -> Path:
        return self._spool_dir / f"{self._table}.jsonl"

    def _spool_append(self, rows: list[tuple]) -> None:
        if not self._spool_dir:
            logger.error("spool_dir kosong: %d baris %s HILANG", len(rows), self._table)
            return
        path = self._spool_path()
        try:
            if path.exists() and path.stat().st_size > self._spool_max_bytes:
                rotated = self._spool_dir / f"{self._table}-{int(time.time())}.jsonl"
                path.rename(rotated)
                self._prune_spool()
            with path.open("a", encoding="utf-8") as f:
                for row in rows:
                    f.write(json.dumps(row, default=str) + "\n")
            logger.warning("spool %s: +%d baris", self._table, len(rows))
        except Exception:
            logger.exception("spool %s GAGAL — %d baris hilang", self._table, len(rows))

    def _prune_spool(self) -> None:
        files = sorted(self._spool_dir.glob(f"{self._table}-*.jsonl"), key=os.path.getmtime)
        total = sum(p.stat().st_size for p in files)
        if self._spool_path().exists():
            total += self._spool_path().stat().st_size
        for p in files:
            if total <= self._spool_max_bytes:
                break
            total -= p.stat().st_size
            logger.error("spool %s penuh, hapus file lama %s", self._table, p.name)
            p.unlink(missing_ok=True)

    def _revive(self, row: tuple) -> tuple:
        """Kembalikan tipe kolom ts (string hasil JSON -> datetime)."""
        if self._ts_index is None:
            return row
        vals = list(row)
        v = vals[self._ts_index]
        if isinstance(v, str):
            try:
                vals[self._ts_index] = datetime.fromisoformat(v)
            except ValueError:
                pass
        return tuple(vals)

    def _drain_spool(self, max_batches: int = 10) -> int:
        """Replay isi spool. Maksimum max_batches x batch_size per siklus."""
        if not self._spool_dir:
            return 0
        sent = 0
        batches = 0
        while batches < max_batches:
            files = sorted(self._spool_dir.glob(f"{self._table}*.jsonl"), key=os.path.getmtime)
            if not files:
                break
            path = files[0]
            try:
                lines = path.read_text(encoding="utf-8").splitlines()
            except FileNotFoundError:
                continue
            lines = [l for l in lines if l.strip()]
            if not lines:
                path.unlink(missing_ok=True)
                continue
            chunk = [self._revive(tuple(json.loads(l))) for l in lines[: self._batch_size]]
            if not self._try_insert(chunk):
                break
            sent += len(chunk)
            batches += 1
            rest = lines[self._batch_size:]
            if rest:
                path.write_text("\n".join(rest) + "\n", encoding="utf-8")
            else:
                path.unlink(missing_ok=True)
        if sent:
            logger.info("drain spool %s: %d baris terkirim", self._table, sent)
        return sent

    def _try_insert(self, rows: list[tuple]) -> bool:
        from app.clickhouse_client import insert_rows

        try:
            insert_rows(self._table, rows, self._column_names)
            return True
        except Exception as exc:
            logger.warning("insert ke %s gagal: %s", self._table, exc)
            return False


telemetry_buffer = AsyncBatchBuffer(
    table="telemetry",
    column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
    max_buffered_rows=settings.ingest_max_buffered_rows,
    spool_dir=settings.ingest_spool_dir,
    spool_max_bytes=settings.ingest_spool_max_mb * 1024 * 1024,
    backoff_max_seconds=settings.ingest_backoff_max_seconds,
    ts_index=5,
)

device_status_buffer = AsyncBatchBuffer(
    table="device_status",
    column_names=["tenant_slug", "site_slug", "device_key", "status", "ts", "raw_payload"],
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
    max_buffered_rows=settings.ingest_max_buffered_rows,
    spool_dir=settings.ingest_spool_dir,
    spool_max_bytes=settings.ingest_spool_max_mb * 1024 * 1024,
    backoff_max_seconds=settings.ingest_backoff_max_seconds,
    ts_index=4,
)
