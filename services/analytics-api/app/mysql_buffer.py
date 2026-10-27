import asyncio
import logging
from datetime import datetime
from typing import Any

from app.config import settings

logger = logging.getLogger("mysql-buffer")

# Alias pemetaan kolom flat
_VOLTAGE_KEYS = ("voltage", "v_pv", "v_busbar", "v_mppt_out", "v_dc_bus")
_CURRENT_KEYS = ("current", "i_pv", "i_mppt_out", "i_rectifier")
_POWER_KEYS = ("power", "p_pv", "p_mppt_out", "p_rectifier")
_ENERGY_KEYS = ("energy", "total_energy", "daily_energy", "kwh", "kwh_total")
_FREQ_KEYS = ("frequency", "freq", "hz")
_PF_KEYS = ("power_factor", "pf")
_TEMP_KEYS = ("temperature", "temp_mppt", "temp")


def _find_metric(metric_dict: dict[str, float], keys: tuple[str, ...]) -> float | None:
    for k in keys:
        if k in metric_dict:
            return metric_dict[k]
        # juga cek lowercase
        for m_key, m_val in metric_dict.items():
            if m_key.lower() == k.lower():
                return m_val
    return None


def flatten_telemetry_for_mysql(
    tenant_slug: str,
    site_slug: str,
    device_key: str,
    ts: datetime,
    metrics: list[tuple[str, float]],
    raw_payload: str,
) -> dict[str, Any]:
    metric_dict = {name: val for name, val in metrics}

    return {
        "ts": ts,
        "device_id": device_key,
        "tenant_slug": tenant_slug,
        "site_slug": site_slug,
        "voltage": _find_metric(metric_dict, _VOLTAGE_KEYS),
        "current": _find_metric(metric_dict, _CURRENT_KEYS),
        "power": _find_metric(metric_dict, _POWER_KEYS),
        "energy": _find_metric(metric_dict, _ENERGY_KEYS),
        "frequency": _find_metric(metric_dict, _FREQ_KEYS),
        "power_factor": _find_metric(metric_dict, _PF_KEYS),
        "temperature": _find_metric(metric_dict, _TEMP_KEYS),
        "raw_payload": raw_payload,
    }


class AsyncMySQLBatchBuffer:
    """Asynchronous batch buffer untuk menyalin data flat telemetry ke MySQL.
    Non-blocking terhadap pipeline utama ClickHouse.
    """

    def __init__(
        self,
        batch_size: int = 200,
        flush_interval: float = 2.0,
        max_buffered_rows: int = 10_000,
    ) -> None:
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._max_buffered_rows = max_buffered_rows
        self._rows: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None

    async def add(self, record: dict[str, Any]) -> None:
        if not settings.mysql_enabled:
            return

        should_flush = False
        async with self._lock:
            self._rows.append(record)
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
            await asyncio.to_thread(self._insert_sync, rows_to_insert)
            return len(rows_to_insert)
        except Exception as exc:
            logger.warning(
                "Gagal flush batch telemetri ke MySQL (%d baris): %s. Mengembalikan data ke antrean.",
                len(rows_to_insert),
                exc,
            )
            async with self._lock:
                self._rows = rows_to_insert + self._rows
                if len(self._rows) > self._max_buffered_rows:
                    overflow = len(self._rows) - self._max_buffered_rows
                    logger.warning("Buffer MySQL melebihi kapasitas maksimum (%d). Membuang %d baris tertua.", self._max_buffered_rows, overflow)
                    self._rows = self._rows[overflow:]
            return 0

    def _insert_sync(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return

        import pymysql

        conn = pymysql.connect(
            host=settings.mysql_host,
            port=settings.mysql_port,
            user=settings.mysql_user,
            password=settings.mysql_password,
            database=settings.mysql_db,
            connect_timeout=3,
            autocommit=True,
        )
        try:
            with conn.cursor() as cursor:
                sql = """
                    INSERT INTO telemetry (
                        ts, device_id, tenant_slug, site_slug,
                        voltage, current, power, energy, frequency, power_factor, temperature, raw_payload
                    ) VALUES (
                        %(ts)s, %(device_id)s, %(tenant_slug)s, %(site_slug)s,
                        %(voltage)s, %(current)s, %(power)s, %(energy)s, %(frequency)s, %(power_factor)s, %(temperature)s, %(raw_payload)s
                    )
                """
                cursor.executemany(sql, rows)
        finally:
            conn.close()

    def start_periodic_flush(self) -> None:
        if self._task is not None:
            return

        async def _loop() -> None:
            while True:
                await asyncio.sleep(self._flush_interval)
                try:
                    await self.flush()
                except Exception as exc:
                    logger.exception("Error di periodic flush MySQL: %s", exc)

        self._task = asyncio.create_task(_loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self.flush()


mysql_telemetry_buffer = AsyncMySQLBatchBuffer(
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
)
