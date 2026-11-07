#!/usr/bin/env python3
"""Jaring pengaman memori ClickHouse.

Kalau MemoryTracking >= THRESHOLD dari max_server_memory_usage selama 2 cek
berturut-turut (default 2 x 5 menit), ClickHouse di-restart terkontrol:
data di disk aman, downtime ~10 detik, tracker memori di-reset.

Ini BUKAN perbaikan akar masalah (itu upgrade ClickHouse / fix jalur ingest),
ini mencegah dashboard mati total sementara akar masalah belum dikerjakan.

Dijalankan cron tiap 5 menit. Log: /var/log/iiot-memory-guard.log
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys

THRESHOLD = 0.85          # 85% dari max_server_memory_usage (2.75 GiB)
SERVER_LIMIT = 2_952_790_016
STATE = "/var/lib/iiot-memory-guard.json"
LOG = "/var/log/iiot-memory-guard.log"
CONTAINER = "iiot-clickhouse"


def sh(cmd: str, timeout: int = 60) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() or r.stderr.strip()
    except Exception as exc:  # noqa: BLE001
        return f"ERR {exc}"


def log(msg: str) -> None:
    line = f"{dt.datetime.now(dt.timezone.utc).isoformat()} {msg}"
    print(line)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def main() -> int:
    raw = sh(f'docker exec {CONTAINER} clickhouse-client -q '
             f'"SELECT value FROM system.metrics WHERE metric=\'MemoryTracking\'"')
    if not raw.isdigit():
        log(f"WARN tidak bisa baca MemoryTracking: {raw[:120]}")
        return 0

    mem = int(raw)
    ratio = mem / SERVER_LIMIT
    try:
        state = json.load(open(STATE))
    except Exception:
        state = {}

    if ratio < THRESHOLD:
        if state.get("strikes"):
            log(f"OK memori turun ke {ratio:.0%} — hitungan strike direset")
        json.dump({"strikes": 0}, open(STATE, "w"))
        return 0

    strikes = int(state.get("strikes", 0)) + 1
    log(f"WARN memori {ratio:.0%} ({mem / 2**30:.2f} GiB / {SERVER_LIMIT / 2**30:.2f} GiB), strike {strikes}")

    if strikes < 2:
        json.dump({"strikes": strikes}, open(STATE, "w"))
        return 0

    log("ACTION restart ClickHouse terkontrol (memori menembus ambang 2x berturut-turut)")
    out = sh(f"docker restart {CONTAINER}", timeout=180)
    log(f"restart: {out[:120]}")

    for _ in range(24):
        status = sh(f"docker inspect {CONTAINER} --format '{{{{.State.Health.Status}}}}'")
        if status == "healthy":
            break
        import time
        time.sleep(5)
    after = sh(f'docker exec {CONTAINER} clickhouse-client -q '
               f'"SELECT formatReadableSize(value) FROM system.metrics WHERE metric=\'MemoryTracking\'"')
    log(f"selesai: health={status} memori={after}")
    json.dump({"strikes": 0, "last_restart": dt.datetime.now(dt.timezone.utc).isoformat()},
              open(STATE, "w"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
