import asyncio
import logging
import ssl
from typing import Any

from app.config import settings

logger = logging.getLogger("mysql-sink")

try:
    import pymysql
except ImportError:
    pymysql = None


class MySQLTelemetrySink:
    """Async batch buffer and forwarder ke database MySQL eksternal user.
    
    Karakteristik:
    - Non-blocking terhadap pipeline utama (ingest ClickHouse).
    - Memfilter data berdasarkan tenant slug tertentu (hanya data tenant user tersebut).
    - Memasukkan telemetri format (a):
      (tenant_slug, site_slug, device_key, metric_name, metric_value, ts, raw_payload)
    - Auto create table IF NOT EXISTS dengan SSL/TLS support.
    - Retry in-memory dengan buffer overflow protection.
    """

    def __init__(self) -> None:
        self.enabled = settings.mysql_sink_enabled
        self.host = settings.mysql_sink_host
        self.port = settings.mysql_sink_port
        self.db_name = settings.mysql_sink_db
        self.user = settings.mysql_sink_user
        self.password = settings.mysql_sink_password
        self.table = settings.mysql_sink_table
        self.tenant_slug = settings.mysql_sink_tenant_slug.strip()
        self.use_ssl = settings.mysql_sink_use_ssl
        self.ssl_ca = settings.mysql_sink_ssl_ca
        self.ssl_verify_cert = settings.mysql_sink_ssl_verify_cert
        self.batch_size = settings.mysql_sink_batch_size
        self.flush_interval = settings.mysql_sink_flush_interval_seconds
        self.max_buffered_rows = settings.mysql_sink_max_buffered_rows

        self._rows: list[tuple] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._table_checked = False

    def is_target_tenant(self, tenant_slug: str) -> bool:
        if not self.enabled:
            return False
        # Jika mysql_sink_tenant_slug diisi, filter hanya slug tersebut.
        # Jika dibiarkan kosong, maka forward semua (opsional fallback).
        if self.tenant_slug and tenant_slug != self.tenant_slug:
            return False
        return True

    def _get_connection(self) -> Any:
        if pymysql is None:
            raise RuntimeError("PyMySQL belum terinstall.")

        ssl_ctx: dict[str, Any] | ssl.SSLContext | None = None
        if self.use_ssl:
            if self.ssl_ca:
                ssl_ctx = ssl.create_default_context(cafile=self.ssl_ca)
                if not self.ssl_verify_cert:
                    ssl_ctx.check_hostname = False
                    ssl_ctx.verify_mode = ssl.CERT_NONE
            else:
                ssl_ctx = ssl.create_default_context()
                if not self.ssl_verify_cert:
                    ssl_ctx.check_hostname = False
                    ssl_ctx.verify_mode = ssl.CERT_NONE

        return pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.db_name,
            connect_timeout=5,
            read_timeout=10,
            write_timeout=10,
            autocommit=True,
            ssl=ssl_ctx,
            charset="utf8mb4",
        )

    def _ensure_table_exists(self, conn: Any) -> None:
        """Membuat tabel skema (a) secara otomatis jika belum ada."""
        if self._table_checked:
            return

        create_sql = f"""
        CREATE TABLE IF NOT EXISTS `{self.table}` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `tenant_slug` VARCHAR(64) NOT NULL,
            `site_slug` VARCHAR(64) NOT NULL,
            `device_key` VARCHAR(64) NOT NULL,
            `metric_name` VARCHAR(64) NOT NULL,
            `metric_value` DOUBLE NOT NULL,
            `ts` DATETIME(3) NOT NULL,
            `raw_payload` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_tenant_site_device` (`tenant_slug`, `site_slug`, `device_key`),
            INDEX `idx_metric_ts` (`metric_name`, `ts`),
            INDEX `idx_ts` (`ts`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        with conn.cursor() as cursor:
            cursor.execute(create_sql)
        self._table_checked = True
        logger.info("Tabel MySQL user `%s` siap digunakan.", self.table)

    def _insert_batch_sync(self, rows: list[tuple]) -> None:
        conn = self._get_connection()
        try:
            self._ensure_table_exists(conn)
            sql = f"""
            INSERT INTO `{self.table}` 
            (tenant_slug, site_slug, device_key, metric_name, metric_value, ts, raw_payload)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            with conn.cursor() as cursor:
                cursor.executemany(sql, rows)
            logger.debug("Berhasil kirim %d baris telemetri ke MySQL user.", len(rows))
        finally:
            conn.close()

    async def add(self, row: tuple) -> None:
        """Menambahkan tuple telemetri ke sink buffer jika tenant cocok."""
        if not self.enabled:
            return

        tenant_slug = row[0]
        if not self.is_target_tenant(tenant_slug):
            return

        should_flush = False
        async with self._lock:
            self._rows.append(row)
            if len(self._rows) >= self.batch_size:
                should_flush = True

        if should_flush:
            await self.flush()

    async def flush(self) -> int:
        """Flush in-memory batch ke MySQL user via asyncio thread executor."""
        async with self._lock:
            if not self._rows:
                return 0
            rows_to_insert = self._rows
            self._rows = []

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._insert_batch_sync, rows_to_insert)
            return len(rows_to_insert)
        except Exception as exc:
            logger.warning(
                "Gagal insert batch ke MySQL user (%d baris): %s. Mengembalikan ke antrean untuk dicoba ulang.",
                len(rows_to_insert),
                exc,
            )
            async with self._lock:
                combined = rows_to_insert + self._rows
                if len(combined) > self.max_buffered_rows:
                    overflow = len(combined) - self.max_buffered_rows
                    logger.error(
                        "Buffer MySQL sink melampaui batas %d baris. Membuang %d baris terlama.",
                        self.max_buffered_rows,
                        overflow,
                    )
                    combined = combined[overflow:]
                self._rows = combined
            return 0

    async def _periodic_flush(self) -> None:
        while True:
            await asyncio.sleep(self.flush_interval)
            await self.flush()

    def start(self) -> None:
        if not self.enabled:
            logger.info("MySQL Sink dinonaktifkan (mysql_sink_enabled=False).")
            return

        if pymysql is None:
            logger.warning("PyMySQL tidak terinstall. MySQL Sink dilewati.")
            return

        if self._task is None:
            self._task = asyncio.create_task(self._periodic_flush())
            logger.info(
                "MySQL Sink aktif untuk tenant='%s' menuju %s:%d/%s",
                self.tenant_slug or "(all)",
                self.host,
                self.port,
                self.db_name,
            )

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None
        await self.flush()

    async def clear(self) -> None:
        """Kosongkan antrean memori tanpa eksekusi insert (berguna untuk unit testing)."""
        async with self._lock:
            self._rows = []


mysql_sink = MySQLTelemetrySink()

