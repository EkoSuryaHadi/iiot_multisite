# IIoT Platform — Insiden Memori ClickHouse & Pengamanan Permanen

**Host:** 38.47.180.128 (`iiot-server`) · **Tanggal tindakan:** 5 November 2026 · **Oleh:** Hermes + Eko

---

## 1. Apa yang terjadi

Semua container terlihat `healthy`, dashboard bisa dibuka (HTTP 200), device tetap terkoneksi ke MQTT — **tetapi setiap query analitik ditolak**. Bahkan `SELECT count() FROM iiot.telemetry` gagal.

```
Code: 241. DB::Exception: Memory limit (total) exceeded:
would use 3.62 GiB, maximum: 3.60 GiB (MEMORY_LIMIT_EXCEEDED)
```

- `MEMORY_LIMIT_EXCEEDED` tercatat **39.376 kali**, error pertama **27 Okt 04:29 UTC**
- Puncaknya **1.589 kegagalan dalam satu jam** tepat sebelum perbaikan
- Healthcheck container **tidak mendeteksi apa pun** karena `/health` hanya mengecek proses API, bukan ClickHouse

**Dampak:** data telemetry bolong di 25 Okt, 30 Okt–1 Nov, dan 3–4 Nov.

## 2. Akar masalah

1. ClickHouse berjalan di cgroup **4 GiB**, dan default-nya boleh memakai **90% (3,60 GiB)**.
2. `max_memory_usage = 0` → **tidak ada batas per query**. Satu query boros boleh mengambil seluruh anggaran server.
3. Begitu plafon tersentuh, **INSERT dari jalur ingest ikut gagal**. Buffer ingest (`AsyncBatchBuffer`) mengembalikan baris ke antrean dan mencoba lagi setiap 2 detik → **retry storm**.
4. Memori yang gagal dialokasikan tidak terlepas sempurna; tracker menumpuk selama 9 hari hingga semua query — termasuk yang paling ringan — ditolak.
5. Tidak ada alerting. Tidak ada yang tahu selama 9 hari.

## 3. Perbaikan yang sudah diterapkan

### 3a. Guardrail memori (diuji di container terpisah sebelum menyentuh produksi)

`services/clickhouse/config.d/tuning.xml`
- `max_server_memory_usage` = **2,75 GiB** (dari 3,60 GiB) → selalu ada ~1,25 GiB sisa untuk merge, HTTP handler, dan OS
- `max_concurrent_queries` = 24
- `query_log` TTL 3 hari (tadinya 345 ribu baris menumpuk)

`services/clickhouse/users.d/limits.xml` (mount baru di `docker-compose.prod.yml`)
- `max_memory_usage` = **1,5 GiB per query** (dari 0 = tanpa batas)
- `max_memory_usage_for_user` = 2 GiB
- `max_bytes_before_external_group_by` / `max_bytes_before_external_sort` = 512 MB → agregasi besar **spill ke disk**, bukan makan RAM
- `max_threads` = 4

### 3b. Watchdog (Hermes cron, tiap 15 menit)

`~/.hermes/scripts/iiot_watchdog.py` — senyap kalau sehat, kirim alert ke Telegram kalau:
- ClickHouse tidak `running`/`healthy`, atau restart-nya bertambah
- Query nyata ke telemetry gagal
- Data terakhir lebih tua dari 30 menit
- `MEMORY_LIMIT_EXCEEDED > 0`
- Memori ClickHouse ≥ 80% (warning) / ≥ 95% (critical) dari plafon
- Frontend tidak menjawab HTTP 200

## 4. Hasil (terverifikasi, bukan klaim)

| Metrik | Sebelum | Sesudah |
|---|---|---|
| MemoryTracking | 3,94 GiB (plafon 3,60) | **0,51 GiB** |
| `SELECT count()` | ditolak | **351.761 baris** |
| MEMORY_LIMIT_EXCEEDED | 39.376 | **0** |
| Load average (4 core) | 6,29 | **0,56–2,68** |
| Host RAM terpakai | 4,4 GiB | **1,2 GiB** |
| Data terakhir | — | **real-time (0 menit)** |
| Restart ClickHouse | — | 0 (stabil) |

## 5. Cara cek manual

```bash
ssh root@38.47.180.128

# kesehatan nyata ClickHouse (bukan /health kontainer)
docker exec iiot-clickhouse clickhouse-client -q \
  "SELECT count(), max(ts), dateDiff('minute', max(ts), now()) FROM iiot.telemetry WHERE ts > now()-INTERVAL 2 HOUR"

# memori vs plafon
docker exec iiot-clickhouse clickhouse-client -q \
  "SELECT formatReadableSize(value) FROM system.metrics WHERE metric='MemoryTracking'"

# error yang muncul sejak start
docker exec iiot-clickhouse clickhouse-client -q \
  "SELECT name, value FROM system.errors WHERE value > 0"
```

## 6. Runbook kalau memori mentok lagi

1. **Alert masuk Telegram** → jangan panik, dashboard boleh tetap jalan.
2. Cek penyebab:
   `SELECT * FROM system.processes` (query apa yang sedang jalan)
   `SELECT * FROM system.errors WHERE name='MEMORY_LIMIT_EXCEEDED'`
3. Kalau ada query berat yang macet → `KILL QUERY WHERE query_id='...'`.
4. Kalau tracker tetap tinggi tanpa query aktif (pola insiden ini):
   `docker restart iiot-clickhouse` — data di disk aman, downtime ~10 detik.
5. Verifikasi dengan tiga perintah di bagian 5.

## 7. Yang belum dikerjakan (rekomendasi berikutnya)

| Prioritas | Item | Kenapa |
|---|---|---|
| P1 | **Spool ke disk di `AsyncBatchBuffer`** | Sekarang kalau insert gagal, data cuma ditahan di RAM sampai 100.000 baris, lalu **dibuang yang terlama** — inilah penyebab data bolong. Spool ke file = nol kehilangan data. |
| P1 | **Backup otomatis** | Belum ada backup terjadwal sama sekali. ClickHouse sudah mendukung `BACKUP ... TO Disk('default', ...)`; tinggal cron + rotasi. |
| P2 | **Alert eskalasi** | Watchdog 15 menit cukup untuk sekarang; tambah alert harian berisi ringkasan (row count per hari) supaya bolong data terdeteksi cepat. |
| P2 | **Upgrade ClickHouse 24.8 → 25.x LTS** | Versi sekarang punya perilaku tracker memori yang bisa macet saat insert gagal berulang. Upgrade menutup kelas masalah ini, bukan cuma menahannya. |
| P3 | **TTL & kapasitas** | `telemetry` TTL 730 hari, disk 81 GB bebas. Proyeksi masih aman, tapi perlu hitungan formal sebelum data tumbuh. |

## 8. File yang berubah di server

```
/opt/iiot_multisite/services/clickhouse/config.d/tuning.xml      (diperbarui, backup .bak-*)
/opt/iiot_multisite/services/clickhouse/users.d/limits.xml       (baru)
/opt/iiot_multisite/docker-compose.prod.yml                      (1 baris mount baru, backup .bak-*)
```
