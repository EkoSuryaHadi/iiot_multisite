# IIoT — Panduan Perubahan Kode & Konfigurasi
**Tanggal:** 5 November 2026 · **Host:** 38.47.180.128 · **Repo:** `/opt/iiot_multisite`

Dokumen ini dipakai untuk menyamakan repo dengan kondisi server sekarang, lalu mengerjakan
perubahan kode yang belum dilakukan. Urutannya: **A. yang sudah berubah di server** →
**B. yang harus lo ubah di kode** → **C. deploy & verifikasi** → **D. rollback**.

---

## RINGKASAN

| # | Item | Status | Lokasi |
|---|---|---|---|
| A1 | Batas memori server ClickHouse | ✅ sudah live | `services/clickhouse/config.d/tuning.xml` |
| A2 | Batas memori per query + spill disk | ✅ sudah live | `services/clickhouse/users.d/limits.xml` (baru) |
| A3 | Mount `users.d` di compose | ✅ sudah live | `docker-compose.prod.yml` |
| B1 | Spool disk + backoff di buffer ingest | ❌ belum | `services/analytics-api/app/buffer.py` |
| B2 | Setting baru (spool, timeout, batas query) | ❌ belum | `services/analytics-api/app/config.py` |
| B3 | Timeout + batas memori di client ClickHouse | ❌ belum | `services/analytics-api/app/clickhouse_client.py` |
| B4 | Endpoint `/health/deep` yang benar-benar cek data | ❌ belum | `services/analytics-api/app/main.py` |
| B5 | Backup terjadwal + uji restore | ❌ belum | `tools/clickhouse_backup.sh` + cron |
| B6 | Healthcheck compose pakai deep-check | ❌ belum (opsional) | `docker-compose.prod.yml` |

> **Penting:** `git status` menunjukkan A1–A3 masih **belum di-commit**. Commit dulu supaya tidak hilang saat deploy berikutnya.

---

## A. YANG SUDAH DIUBAH DI SERVER (samakan di repo)

### A1. `services/clickhouse/config.d/tuning.xml`

```xml
<clickhouse>
    <!-- Disable system logs that bloat memory and disk -->
    <text_log remove="1"/>
    <trace_log remove="1"/>
    <metric_log remove="1"/>
    <asynchronous_metric_log remove="1"/>
    <processors_profile_log remove="1"/>
    <query_thread_log remove="1"/>
    <query_views_log remove="1"/>
    <opentelemetry_span_log remove="1"/>
    <asynchronous_insert_log remove="1"/>
    <session_log remove="1"/>
    <part_log remove="1"/>

    <!-- Restrict cache allocations -->
    <mark_cache_size>104857600</mark_cache_size>
    <uncompressed_cache_size>104857600</uncompressed_cache_size>
    <max_table_size_to_drop>0</max_table_size_to_drop>

    <!-- Allow native BACKUP/RESTORE to the default disk -->
    <backups>
        <allowed_disk>default</allowed_disk>
    </backups>

    <!-- ===== MEMORY GUARDRAIL =====
         cgroup container 4 GiB. Server dibatasi 2.75 GiB supaya selalu ada
         ~1.25 GiB untuk merge, HTTP handler, dan OS. Tanpa ini ClickHouse
         boleh memakai 90% cgroup (3.60 GiB) dan satu loop kegagalan bisa
         menahan seluruh memori -> semua query ditolak MEMORY_LIMIT_EXCEEDED. -->
    <max_server_memory_usage>2952790016</max_server_memory_usage>

    <max_concurrent_queries>24</max_concurrent_queries>

    <query_log>
        <database>system</database>
        <table>query_log</table>
        <flush_interval_milliseconds>7500</flush_interval_milliseconds>
        <ttl>event_date + INTERVAL 3 DAY</ttl>
    </query_log>
</clickhouse>
```

### A2. `services/clickhouse/users.d/limits.xml` (file baru)

```xml
<clickhouse>
    <!-- Sebelumnya max_memory_usage = 0 (tanpa batas per query): satu query
         salah bisa mengambil seluruh anggaran server dan membuat ingest
         gagal berantai. Dengan 1.5 GiB, query boros dibatalkan sendiri dan
         server tetap hidup. -->
    <profiles>
        <default>
            <max_memory_usage>1610612736</max_memory_usage>
            <max_memory_usage_for_user>2147483648</max_memory_usage_for_user>
            <!-- GROUP BY / ORDER BY besar dibuang ke disk, bukan ke RAM -->
            <max_bytes_before_external_group_by>536870912</max_bytes_before_external_group_by>
            <max_bytes_before_external_sort>536870912</max_bytes_before_external_sort>
            <max_threads>4</max_threads>
        </default>
    </profiles>
</clickhouse>
```

### A3. `docker-compose.prod.yml` — service `clickhouse`, bagian `volumes`

Tambahkan satu baris (sudah diterapkan, baris ke-55):

```yaml
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - ./services/clickhouse/init:/docker-entrypoint-initdb.d
      - ./services/clickhouse/config.d/tuning.xml:/etc/clickhouse-server/config.d/tuning.xml:ro
      - ./services/clickhouse/users.d/limits.xml:/etc/clickhouse-server/users.d/limits.xml:ro   # <-- BARU
```

### A4. Bukti hasil (sudah terverifikasi)

| Metrik | Sebelum | Sesudah |
|---|---|---|
| MemoryTracking | 3,94 GiB (plafon 3,60) | **0,51 GiB** |
| `SELECT count()` | ditolak (Kode 241) | **352.622 baris** |
| MEMORY_LIMIT_EXCEEDED | 39.376 | **0** |
| Load average 4 core | 6,29 | **1,49** |
| Restart ClickHouse | — | 0 |

---

## B. YANG PERLU LO UBAH DI KODE

### B1. `services/analytics-api/app/buffer.py` — spool ke disk + backoff

**Masalah di kode sekarang:**
1. Kalau insert gagal, baris dikembalikan ke antrean **di RAM**, dicoba ulang **tiap 2 detik** → retry storm (insiden kemarin: 1.589 kegagalan/jam).
2. Begitu antrean lewat `max_buffered_rows` (100.000), **baris terlama dibuang**. Ini penyebab persis data bolong 25 Okt, 30 Okt–1 Nov, 3–4 Nov.

**Ganti seluruh isi `buffer.py` dengan ini:**

```python
import asyncio
import json
import logging
import os
import time
from pathlib import Path

from app.config import settings

logger = logging.getLogger("ingest-buffer")


class AsyncBatchBuffer:
    """Buffer batch insert ke ClickHouse dengan spool disk dan backoff.

    Alur:
      add()  -> antrean memori -> flush saat batch penuh / timer
      flush() sukses  -> drain spool (data lama dikirim lebih dulu)
      flush() gagal   -> baris DITULIS KE DISK (jsonl), bukan dibuang,
                         lalu backoff eksponensial supaya tidak retry storm
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
    ) -> None:
        self._table = table
        self._column_names = column_names
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._max_buffered_rows = max_buffered_rows
        self._spool_dir = Path(spool_dir) if spool_dir else None
        self._spool_max_bytes = spool_max_bytes
        self._backoff_max = backoff_max_seconds

        self._rows: list[tuple] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._fails = 0
        self._next_try_at = 0.0

        if self._spool_dir:
            self._spool_dir.mkdir(parents=True, exist_ok=True)

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
            ok = await asyncio.to_thread(self._try_insert, rows)
            if ok:
                inserted += len(rows)
                self._fails = 0
                self._next_try_at = 0.0
            else:
                await asyncio.to_thread(self._spool_append, rows)
                self._bump_backoff()
                return 0

        # kirim data yang tertahan di disk (juga saat antrean memori sedang kosong)
        if self._spool_dir:
            inserted += await asyncio.to_thread(self._drain_spool)
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
        async with self._lock:
            self._rows = []

    # ---------- internal ----------

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
        if path.exists() and path.stat().st_size > self._spool_max_bytes:
            rotated = self._spool_dir / f"{self._table}-{int(time.time())}.jsonl"
            path.rename(rotated)
            self._prune_spool()
        with path.open("a", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, default=str) + "\n")
        logger.warning("spool %s: +%d baris", self._table, len(rows))

    def _prune_spool(self) -> None:
        files = sorted(self._spool_dir.glob(f"{self._table}-*.jsonl"), key=os.path.getmtime)
        total = sum(p.stat().st_size for p in files) + (self._spool_path().stat().st_size
                                                        if self._spool_path().exists() else 0)
        for p in files:
            if total <= self._spool_max_bytes:
                break
            total -= p.stat().st_size
            logger.error("spool %s penuh, hapus file lama %s", self._table, p.name)
            p.unlink(missing_ok=True)

    def _drain_spool(self, max_batches: int = 10) -> int:
        """Kirim balik isi spool. Maksimum `max_batches` x batch_size per siklus
        supaya proses lain tetap dapat giliran, tapi backlog tidak mengendap."""
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
            if not lines:
                path.unlink(missing_ok=True)
                continue
            chunk = [tuple(json.loads(l)) for l in lines[: self._batch_size]]
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
        from app.clickhouse_client import get_client
        try:
            get_client().insert(self._table, rows, column_names=self._column_names)
            return True
        except Exception as exc:
            logger.warning("insert ke %s gagal: %s", self._table, exc)
            return False


telemetry_buffer = AsyncBatchBuffer(
    table="telemetry",
    column_names=["tenant_slug", "site_slug", "device_key", "metric_name",
                  "metric_value", "ts", "raw_payload"],
    batch_size=settings.ingest_batch_size,
    flush_interval=settings.ingest_flush_interval_seconds,
    max_buffered_rows=settings.ingest_max_buffered_rows,
    spool_dir=settings.ingest_spool_dir,
    spool_max_bytes=settings.ingest_spool_max_mb * 1024 * 1024,
    backoff_max_seconds=settings.ingest_backoff_max_seconds,
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
)
```

**Wajib:** volume spool harus persisten — tambahkan di `docker-compose.prod.yml` service `analytics-api`:

```yaml
    volumes:
      - analytics-spool:/var/lib/iiot/spool
```

dan di bagian `volumes:` paling bawah:

```yaml
volumes:
  analytics-spool:
```

### B1b. `services/analytics-api/tests/test_buffer_spool.py` (file baru, uji wajib)

Kode di B1 sudah diuji dengan simulasi ClickHouse menolak insert. Test ini mengunci perilakunya:
tidak ada baris hilang saat ClickHouse mati, spool kosong setelah pulih, jalur normal tidak berubah.

```python
import asyncio

import pytest

from app import clickhouse_client as ch
from app.buffer import AsyncBatchBuffer


class FakeClient:
    def __init__(self):
        self.fail = True
        self.rows = []

    def insert(self, table, rows, column_names=None):
        if self.fail:
            raise RuntimeError("MEMORY_LIMIT_EXCEEDED")
        self.rows.extend(rows)


@pytest.fixture
def fake(monkeypatch, tmp_path):
    client = FakeClient()
    monkeypatch.setattr(ch, "get_client", lambda: client)
    buf = AsyncBatchBuffer(
        "telemetry", ["a", "b"], batch_size=3, flush_interval=0.01,
        spool_dir=str(tmp_path), spool_max_bytes=1024 * 1024,
        backoff_max_seconds=0.05,
    )
    return buf, client, tmp_path


def spool_lines(tmp_path):
    return sum(len(p.read_text().splitlines()) for p in tmp_path.glob("*.jsonl"))


@pytest.mark.asyncio
async def test_spool_saat_clickhouse_mati(fake):
    buf, client, tmp = fake
    for i in range(7):
        await buf.add((i, "x"))
    await asyncio.sleep(0.05)
    await buf.flush()
    assert spool_lines(tmp) == 7          # tidak ada yang hilang
    assert client.rows == []


@pytest.mark.asyncio
async def test_drain_setelah_pulih(fake):
    buf, client, tmp = fake
    client.fail = False
    for i in range(7):
        await buf.add((i, "x"))
    await asyncio.sleep(0.05)
    await buf.flush()
    await asyncio.sleep(0.1)
    await buf.flush()
    assert len(client.rows) == 7
    assert spool_lines(tmp) == 0
```

Jalankan: `docker exec iiot-analytics-api pytest -q tests/test_buffer_spool.py`

### B2. `services/analytics-api/app/config.py` — setting baru

Tambahkan setelah `ingest_max_buffered_rows`:

```python
    ingest_spool_dir: str = "/var/lib/iiot/spool"   # None/"" untuk mematikan spool
    ingest_spool_max_mb: int = 512                  # batas total spool per tabel
    ingest_backoff_max_seconds: float = 60.0        # plafon backoff saat insert gagal

    # Batas query dari sisi client (lapis kedua setelah users.d/limits.xml)
    clickhouse_max_memory_per_query: int = 1_610_612_736   # 1.5 GiB
    clickhouse_max_execution_seconds: int = 60
    clickhouse_connect_timeout: int = 5
    clickhouse_send_receive_timeout: int = 60
```

### B3. `services/analytics-api/app/clickhouse_client.py` — timeout + batas query

Ganti fungsi `get_client()` jadi:

```python
def get_client() -> Client:
    if _override_client is not None:
        return _override_client
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            database=settings.clickhouse_db,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
            connect_timeout=settings.clickhouse_connect_timeout,
            send_receive_timeout=settings.clickhouse_send_receive_timeout,
            settings={
                "max_memory_usage": settings.clickhouse_max_memory_per_query,
                "max_execution_time": settings.clickhouse_max_execution_seconds,
                "max_block_size": 65536,
            },
        )
        _thread_local.client = client
    return client
```

Kenapa: tanpa timeout, query yang tertahan bisa menggantung thread FastAPI. Tanpa `max_memory_usage` di sisi client, query ad-hoc dari API tidak ikut aturan profil.

### B4. `services/analytics-api/app/main.py` — health yang benar

`/health` sekarang cuma `SELECT 1` — itu **tetap lolos walau semua query data ditolak**, persis yang bikin insiden kemarin tidak terdeteksi. Tambahkan endpoint baru:

```python
@app.get("/health/deep", tags=["health"])
def health_deep() -> dict:
    """Cek nyata: query data terbaru + memori ClickHouse."""
    from fastapi import HTTPException
    client = get_client()
    try:
        rows, last_ts, age_min = client.query(
            "SELECT count(), max(ts), dateDiff('minute', max(ts), now()) "
            "FROM telemetry WHERE ts > now() - INTERVAL 2 HOUR"
        ).result_rows[0]
        mem = client.query(
            "SELECT value FROM system.metrics WHERE metric='MemoryTracking'"
        ).result_rows[0][0]
        errors = client.query(
            "SELECT value FROM system.errors WHERE name='MEMORY_LIMIT_EXCEEDED'"
        ).result_rows
        mem_err = int(errors[0][0]) if errors else 0
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"clickhouse: {exc}") from exc

    status = "ok"
    if mem_err > 0 or age_min > 30:
        status = "degraded"
    return {
        "status": status,
        "rows_2h": rows,
        "last_ts": str(last_ts),
        "age_minutes": age_min,
        "clickhouse_memory_bytes": mem,
        "memory_limit_errors": mem_err,
    }
```

### B5. Backup terjadwal — `tools/clickhouse_backup.sh` (file baru)

```bash
#!/usr/bin/env bash
# Backup harian database iiot ke volume disk ClickHouse, lalu salin keluar container.
set -euo pipefail

STAMP=$(date -u +%Y-%m-%d)
NAME="iiot_backup_${STAMP}.zip"
OUT="/opt/iiot_backups"
KEEP=7

mkdir -p "$OUT"

docker exec iiot-clickhouse clickhouse-client -q \
  "BACKUP DATABASE iiot TO Disk('default', '${NAME}')"

docker cp "iiot-clickhouse:/var/lib/clickhouse/backups/${NAME}" "${OUT}/${NAME}"
docker exec iiot-clickhouse sh -c "rm -f /var/lib/clickhouse/backups/${NAME}"

find "$OUT" -name 'iiot_backup_*.zip' -mtime +${KEEP} -delete
echo "backup ok: ${OUT}/${NAME} ($(du -h "${OUT}/${NAME}" | cut -f1))"
```

Cron (uji manual dulu, **jangan** pasang sebelum restore test lolos):

```cron
30 2 * * * /opt/iiot_multisite/tools/clickhouse_backup.sh >> /var/log/iiot-backup.log 2>&1
```

**Uji restore (wajib sekali):**

```bash
docker exec iiot-clickhouse clickhouse-client -q \
  "RESTORE DATABASE iiot AS iiot_restore_test FROM Disk('default', 'iiot_backup_YYYY-MM-DD.zip')"
docker exec iiot-clickhouse clickhouse-client -q \
  "SELECT count() FROM iiot_restore_test.telemetry"
docker exec iiot-clickhouse clickhouse-client -q "DROP DATABASE iiot_restore_test"
```

Backup yang belum pernah direstore bukan backup — itu cuma file.

### B6. (Opsional) healthcheck compose untuk ClickHouse

Sekarang `wget /ping` hanya cek proses hidup. Kalau mau container ditandai unhealthy saat query data mati, ganti di `docker-compose.prod.yml`:

```yaml
    healthcheck:
      test: ["CMD-SHELL", "clickhouse-client -q 'SELECT count() FROM iiot.telemetry WHERE ts > now() - INTERVAL 2 HOUR' > /dev/null || exit 1"]
      interval: 60s
      timeout: 20s
      retries: 3
      start_period: 60s
```

Hati-hati: dengan ini, gangguan karena device mati (bukan server) **tidak** akan menandai container unhealthy — query tetap jalan dan mengembalikan 0. Itu memang yang diinginkan.

---

## C. DEPLOY & VERIFIKASI

```bash
cd /opt/iiot_multisite

# 0. commit dulu perubahan infra yang sudah ada
git add services/clickhouse/config.d/tuning.xml services/clickhouse/users.d/limits.xml docker-compose.prod.yml
git commit -m "fix(clickhouse): memory guardrails (server 2.75G, per-query 1.5G, spill disk)"

# 1. bersihkan direktori backup yang tidak perlu (memblok build context)
git status --short | grep '^??'

# 2. build ulang hanya analytics-api
docker compose -f docker-compose.prod.yml build analytics-api
docker compose -f docker-compose.prod.yml up -d analytics-api

# 3. verifikasi
curl -s http://localhost:8000/health/deep   # dari dalam jaringan docker / host
docker exec iiot-analytics-api sh -c 'ls -l /var/lib/iiot/spool'

# 4. uji jalur gagal (WAJIB, jangan skip)
#    hentikan ClickHouse 2 menit, pastikan data masuk ke spool, bukan hilang
docker stop iiot-clickhouse
#    kirim/tunggu data device ~1 menit, lalu:
docker exec iiot-analytics-api sh -c 'wc -l /var/lib/iiot/spool/*.jsonl'
docker start iiot-clickhouse
sleep 60
docker exec iiot-analytics-api sh -c 'ls -l /var/lib/iiot/spool'   # harus menyusut/habis
docker exec iiot-clickhouse clickhouse-client -q "SELECT count() FROM iiot.telemetry WHERE ts > now() - INTERVAL 10 MINUTE"
```

Kriteria lolos:
- `/health/deep` → `status: ok`, `age_minutes` < 5
- Setelah ClickHouse dimatikan: file `*.jsonl` di spool **bertambah**
- Setelah ClickHouse hidup: spool **kosong** dan baris masuk ke tabel
- `SELECT count() ... INTERVAL 10 MINUTE` > 0

---

## D. ROLLBACK

```bash
cd /opt/iiot_multisite
cp services/clickhouse/config.d/tuning.xml.bak-20261105-075707 services/clickhouse/config.d/tuning.xml
cp docker-compose.prod.yml.bak-20261105-075707 docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d clickhouse
```

Untuk rollback kode: `git revert <sha>` lalu build ulang `analytics-api`.
Catatan: mengembalikan `buffer.py` lama berarti kembali ke perilaku **membuang data terlama saat antrean penuh**.

---

## E. CATATAN PENTING

- **Jangan** menaikkan `max_memory_usage` per query ke 0 lagi. Kalau ada query sah yang butuh lebih dari 1,5 GiB, naikkan bertahap ke 2 GiB dan pantau `MEMORY_LIMIT_EXCEEDED` di `system.errors`.
- **Jangan** edit `tuning.xml` langsung di produksi tanpa uji container terpisah — riwayat pernah crash-loop karena ini.
- Direktori `services/frontend_backup_/`, `backup_auth_webhook_*/` ikut masuk build context Docker (build lambat, layer besar). Tambahkan ke `.dockerignore`.
- Setelah semua beres, watchdog 15 menit tetap jalan sebagai jaring terakhir: `~/.hermes/scripts/iiot_watchdog.py` (cron Hermes `c9a7e84dc6a8`).

---

# G. OBJECT STORAGE (MinIO → Garage) — 5 Nov 2026

## G1. Kenapa bukan MinIO

MinIO menarik image & binary komunitasnya di 2025. Hasil uji di server:

| Sumber | Hasil |
|---|---|
| `docker pull minio/minio` | `pull access denied ... may require 'docker login'` |
| `quay.io/minio/minio` | `401 UNAUTHORIZED` |
| `bitnami/minio` | gagal |
| `https://dl.min.io/.../minio` (binary) | `HTTP 410 Gone` |

Jadi MinIO **tidak bisa dipasang tanpa kredensial/registry berbayar**. Yang dipakai: **Garage
v1.0.1** (`dxflrs/garage`), server object storage S3-compatible, Apache-2.0, ~40 MB RAM.

Kalau nanti lo punya lisensi MinIO atau registry sendiri, ganti service `garage` di compose —
selama S3-compatible, `rclone` dan `BACKUP ... TO S3(...)` tidak perlu diubah.

## G2. Yang sudah terpasang

**Service baru** di `docker-compose.prod.yml` (blok `garage`), plus volume `garage-meta` + `garage-data`:

```yaml
  garage:
    image: dxflrs/garage:v1.0.1
    container_name: iiot-garage
    restart: unless-stopped
    mem_limit: 512m
    volumes:
      - garage-meta:/var/lib/garage/meta
      - garage-data:/var/lib/garage/data
      - ./services/garage/garage.toml:/etc/garage.toml:ro
    ports:
      - "127.0.0.1:3900:3900"     # S3 API — hanya localhost + jaringan internal
      - "127.0.0.1:3903:3903"     # admin API — hanya localhost (akses via SSH tunnel)
    networks:
      - iiot-net
```

**Konfigurasi** `services/garage/garage.toml` — kunci penting: `s3_region = "us-east-1"`
(kalau diisi lain, ClickHouse menandatangani request dengan `us-east-1` dan Garage menolak
dengan `Authorization header malformed`).

**Bucket & key:** bucket `iiot-backup`, key `ch-backup` (read/write/owner). Kapasitas layout 60 GB.
Kredensial disimpan di `/opt/iiot_multisite/.env` (`S3_ENDPOINT*`, `S3_BUCKET`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_REGION`), file mode 600.

## G3. Backup offsite — tanpa mengubah script lama

Ternyata `/usr/local/bin/iiot-backup.sh` **sudah ada** dan jalan tiap 02:00 (PostgreSQL + ClickHouse,
verifikasi integritas, retensi 7 hari). Yang selama ini kosong cuma bagian offsite-nya
(`offsite skipped (rclone remote 'iiot-offsite' not configured)`).

Jadi dibuat remote rclone → Garage di `/root/.config/rclone/rclone.conf`:

```ini
[iiot-offsite]
type = s3
provider = Other
access_key_id = <S3_ACCESS_KEY>
secret_access_key = <S3_SECRET_KEY>
endpoint = http://127.0.0.1:3900
region = us-east-1
force_path_style = true
acl = private
```

Script lama otomatis mendeteksi remote ini dan mengunggah dump PostgreSQL + backup ClickHouse +
manifest. **Tidak ada script duplikat** — file `tools/clickhouse_backup.py` yang sempat dibuat
sudah dihapus supaya tidak ada dua jalur backup.

Hasil run nyata (5 Nov 15:41):

```
postgres OK (20467 bytes, archive readable)
clickhouse OK (2461163 bytes)
manifest: pg_tables=8 ch_rows=367007 result=pg=OK ch=OK
offsite OK
RESULT=SUCCESS
```

Isi bucket `iiot-backup`: `ch-20261105-154121.zip` (2.35 MiB), `pg-20261105-154121.dump`, `manifest-...txt`.

## G4. Bukti restore (bukan cuma file ada)

```bash
docker exec iiot-clickhouse clickhouse-client -q \
  "RESTORE DATABASE iiot AS iiot_rst FROM S3('http://iiot-garage:3900/iiot-backup/ch-20261105-154121.zip','<KEY>','<SECRET>')"
docker exec iiot-clickhouse clickhouse-client -q "SELECT count() FROM iiot_rst.telemetry"
# -> 367007   (sama dengan tabel asli)
docker exec iiot-clickhouse clickhouse-client -q "DROP DATABASE iiot_rst"
```

## G5. Perintah operasional

```bash
# isi bucket
rclone ls iiot-offsite:iiot-backup/

# umur backup terakhir (menit)
python3 /opt/iiot_multisite/tools/last_backup_age.py

# jalankan backup sekarang (pg + clickhouse + offsite)
/usr/local/bin/iiot-backup.sh

# akses dashboard Garage dari laptop (SSH tunnel)
# lalu buka http://localhost:3903 (admin API) — bukan web UI, Garage tidak punya UI
ssh -L 3903:127.0.0.1:3903 root@38.47.180.128
```

## G6. Temuan tambahan: monitor sudah ada, tapi bisu

`/usr/local/bin/iiot-monitor.py` jalan tiap 5 menit dan **sudah mendeteksi** masalah:

```
WARN clickhouse OOM events in 24h: 122
```

…tapi hasilnya hanya ditulis ke `/var/log/iiot-monitor/alerts.log`. Tidak ada yang dikirim ke
siapa pun. Sekarang watchdog Hermes (tiap 15 menit) membaca file itu dan meneruskan baris
WARN/CRIT terbaru ke Telegram — dengan dedupe, jadi alert yang sama tidak dikirim berulang.

Status watchdog sekarang: ClickHouse health, query nyata, kesegaran data, MEMORY_LIMIT_EXCEEDED,
pemakaian memori, frontend HTTP, **health Garage**, **umur backup > 36 jam**, dan alert monitor.

## G7. Yang belum

- Sisa kapasitas layout Garage 60 GB; disk bebas 82 GB. Aman untuk ~2 tahun dengan 2,4 MB/hari,
  tapi perlu dipantau kalau volume telemetry tumbuh.
- Belum ada rotasi bucket bulanan di sisi Garage (retensi 7 hari dilakukan script lokal; objek S3
  ikut tumbuh). Tambahkan lifecycle kalau mau otomatis.

---

# H. UPGRADE CLICKHOUSE 24.8 → 25.8 LTS — 7 Nov 2026

## H1. Kenapa

Tracker memori 24.8 tidak melepas alokasi dari query kecil berfrekuensi tinggi. Terukur di
`system.query_log`: ~1.150 query/jam (INSERT + DESCRIBE per insert + `device_last_seen FINAL`),
tanpa satu pun query besar, tapi `MemoryTracking` naik ~195 MiB/jam sampai plafon 2,75 GiB →
seluruh query ditolak. Restart hanya menyembuhkan sementara.

## H2. Prosedur yang dijalankan

1. Backup penuh (PG + ClickHouse + offsite): `RESULT=SUCCESS`, `ch_rows=638.642`.
2. Pull `clickhouse/clickhouse-server:25.8-alpine`.
3. Clone data dir ke `/tmp/ch25data` dan jalankan 25.8 di container terpisah (`ch25-test`)
   dengan `tuning.xml` + `users.d/limits.xml` yang sama → baca 10 tabel, 638.964 baris,
   query MV jalan, setting profil terbaca. **Lolos, tanpa error migrasi.**
4. Stop produksi, salinan konsisten data dir ke `/tmp/ch24-safety` (581 MB).
5. Ganti tag image di `docker-compose.prod.yml` → `25.8-alpine`, `docker compose up -d clickhouse`.
6. Verifikasi produksi.

Downtime aktual: ~1 menit.

## H3. Hasil verifikasi

| Item | Hasil |
|---|---|
| Versi | **25.8.33.6** |
| Tabel `iiot` | 10 (lengkap) |
| Baris telemetry | 641.561, terus bertambah |
| Data terakhir | 0 menit (real-time) |
| `telemetry_agg_1m` | 10.759 bucket, MV hidup |
| Setting profil | 1,5 GiB/query, spill 512 MB, threads 4 — terbaca |
| `MemoryTracking` | **89–90 MiB** dan menurun (dulu naik 195 MiB/jam) |
| Error 241 (10 menit) | 0 |
| Log migrasi | bersih |
| Container | 9/9 healthy, frontend HTTP 200 |

## H4. Rollback (kalau ada apa-apa dalam 24 jam)

```bash
cd /opt/iiot_multisite
docker stop iiot-clickhouse
rm -rf /var/lib/docker/volumes/iiot_multisite_clickhouse-data/_data
cp -a /tmp/ch24-safety/. /var/lib/docker/volumes/iiot_multisite_clickhouse-data/_data/
sed -i 's#clickhouse-server:25.8-alpine#clickhouse-server:24.8-alpine#' docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d clickhouse
```

Catatan: downgrade metadata **tidak** otomatis didukung ClickHouse — rollback hanya aman dengan
salinan data dir di atas, bukan sekadar mengganti tag image.

## H5. Jaring pengaman yang tetap aktif

`/opt/iiot_multisite/tools/ch_memory_guard.py`, cron 5 menit: kalau `MemoryTracking` ≥ 85% dari
plafon dua kali berturut-turut → restart terkontrol + catat di `/var/log/iiot-memory-guard.log`.
Dengan 25.8 ini seharusnya tidak pernah terpicu — biarkan sebagai alarm.

## H6. Sisa pekerjaan (tidak lagi mendesak)

- `DESCRIBE TABLE telemetry` masih ~1 per insert karena `clickhouse_client.py` membuat client per
  thread. Pakai satu writer thread / cache skema → churn turun drastis.
- `device_last_seen ... FINAL` dipanggil ~350×/9 jam; ganti `FINAL` dengan `argMax` per device_key.
- Buffer ingest masih in-memory (spool disk belum di-deploy dari dokumen bagian B1).

---

## I. STATUS DEVICE 3 TINGKAT (dari event koneksi broker) — 8 Nov 2026

### I.1 Masalah
Status di dashboard dihitung **hanya** dari `device_last_seen` (data masuk, ambang 300 detik).
Akibatnya device yang **terhubung ke broker tapi belum mengirim angka** (sensor belum terpasang,
payload `""`) tampil **offline** — menyesatkan saat commissioning: tim lapangan mengira device mati.

### I.2 Yang diubah
1. **Rule EMQX baru** `conn_online` + `conn_offline` (event `$events/client_connected` /
   `$events/client_disconnected`) → action HTTP `analytics_api_conn_online` /
   `analytics_api_conn_offline` → `POST /ingest/connection`.
2. **Endpoint baru** `POST /ingest/connection` (`services/analytics-api/app/routers/ingest.py`):
   memecah `username` `{tenant}-{site}-{device}` (maxsplit 2, jadi device_key boleh mengandung `-`),
   menulis baris ke `device_status`. Username non-device (mis. `internal-service`) dijawab
   `accepted=false` HTTP 200 agar rule tidak dihitung gagal.
3. **`device_counts.py`**:
   - `_CONNECTION_SQL` baru membaca `argMax(status, ts)` dari `device_status`.
   - `resolve_device_states()` mengembalikan field baru `connection`: `connected` / `disconnected` / `null`.
   - `_LAST_SEEN_SQL` **dipindah ke tabel `telemetry`** (bukan `device_last_seen`), karena
     `device_last_seen_status_mv` ikut mencatat event koneksi sehingga device tanpa data tampak online.
4. **Frontend**: `DeviceStatusItem.connection`, badge `StatusPulse` dapat prop `label`; halaman
   `/devices` menampilkan tiga keadaan: hijau *online*, kuning *terhubung* (connect tapi belum ada
   angka), abu *offline*.

### I.3 Batasan yang perlu diketahui
- EMQX build ini **tidak mendukung** `split()`, `nth()`, `re_match()`, `re_replace()`, `substring()`
  (semua melempar `failed.exception`), jadi topik **tidak** dibangun di SQL — dipakai endpoint
  khusus dengan body `{username, status, clientid, publish_received_at}`.
- Device_key yang mengandung `-` aman di backend (maxsplit 2), tapi bila nanti perlu filter di SQL
  EMQX hal itu tidak bisa dilakukan dengan fungsi string di atas.
- Status koneksi mengikuti **username** device. Klien uji lapangan yang memakai client id
  `...-debug` tetap terhitung device yang sama.

### I.4 Verifikasi
- `POST /ingest/connection` device → `{"accepted":true,"rows_buffered":1}`; non-device → `accepted:false`.
- Kick klien `-debug` → muncul dua baris: `offline` 05:51:29 lalu `online` 05:51:30 untuk
  `GNIS_AlphaProject` (event asli dari broker).
- `resolve_device_states('solar')` → `GNIS_AlphaProject: status=offline, connection=connected, last_seen=null`.
- Tes unit analytics-api: 19 passed (3 tes baru `parse_username_slugs`); error yang tersisa
  pre-existing karena fixture `ch_client` butuh service ClickHouse.

### I.5 Rollback
```bash
cd /opt/iiot_multisite
git checkout HEAD~1 -- services/analytics-api services/frontend
docker compose -f docker-compose.prod.yml up -d --build analytics-api frontend
# EMQX: hapus rule & action
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:18083/api/v5/rules/conn_online
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:18083/api/v5/rules/conn_offline
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:18083/api/v5/actions/analytics_api_conn_online
curl -X DELETE -H "Authorization: Bearer $T" http://127.0.0.1:18083/api/v5/actions/analytics_api_conn_offline
```
