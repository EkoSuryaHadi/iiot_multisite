#!/usr/bin/env python3
"""Jaring pengaman memori ClickHouse — v2 (RSS-based).

PELAJARAN dari insiden 13 Nov 2026: guard v1 memantau `MemoryTracking`
(memori ter-lacak CH). Memori yang bikin error 241 justru yang TIDAK
ter-lacak (fragmentasi allocator/jemalloc): MemoryTracking cuma 125 MiB
tapi RSS mentok 2.75 GiB, semua query dibunuh ~1 jam tanpa terdeteksi.

v2 memantau memori proses aktual (cgroup `anon`) terhadap limit container:
- >= 80% limit selama 2 cek berturut-turut (2 x 5 menit) -> restart terkontrol
- MemoryTracking tetap dibaca hanya sebagai info log
- GUARD_DRY_RUN=1 -> log ACTION tapi tidak benar-benar restart (untuk uji)

Dijalankan cron tiap 5 menit. Log: /var/log/iiot-memory-guard.log
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys
import time

THRESHOLD = 0.80            # 80% dari limit memori container
CONTAINER = "iiot-clickhouse"
STATE = "/var/lib/iiot-memory-guard.json"
LOG = "/var/log/iiot-memory-guard.log"
DRY_RUN = os.environ.get("GUARD_DRY_RUN") == "1"


def sh(cmd: str, timeout: int = 60) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (r.stdout.strip() or r.stderr.strip())
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


def read_int(path: str) -> int | None:
    try:
        return int(open(path).read().strip())
    except Exception:
        return None


def cgroup_stat(cid: str, key: str) -> int | None:
    """Baca satu angka dari cgroup v1 memory.stat (utamakan total_*)."""
    for base in (f"/sys/fs/cgroup/memory/docker/{cid}",
                 f"/sys/fs/cgroup/memory/{cid}"):
        raw = None
        for p in (f"{base}/memory.stat",):
            try:
                raw = open(p).read()
            except Exception:
                continue
            if raw:
                vals = {}
                for line in raw.splitlines():
                    parts = line.split()
                    if len(parts) == 2:
                        vals[parts[0]] = int(parts[1])
                v = vals.get(f"total_{key}", vals.get(key))
                if v is not None:
                    return v
    return None


def ch_tracked_mem() -> int | None:
    raw = sh(f"docker exec {CONTAINER} clickhouse-client -q "
             f"\"SELECT value FROM system.metrics WHERE metric='MemoryTracking'\"")
    return int(raw) if raw.isdigit() else None


def main() -> int:
    cid = sh(f"docker inspect {CONTAINER} --format '{{{{.Id}}}}'")
    if not cid or cid.startswith("ERR"):
        log(f"WARN container {CONTAINER} tidak ditemukan: {cid[:80]}")
        return 0

    limit = read_int(f"/sys/fs/cgroup/memory/docker/{cid}/memory.limit_in_bytes")
    if not limit or limit > (1 << 40):  # -1 / unlimited
        raw = sh(f"docker inspect {CONTAINER} --format '{{{{.HostConfig.Memory}}}}'")
        limit = int(raw) if raw.isdigit() else 4_294_967_296

    usage = cgroup_stat(cid, "anon")
    src = "cgroup:anon"
    if usage is None:
        # fallback: parse docker stats (format "3.0GiB / 4GiB")
        stats = sh(f"docker stats --no-stream --format {{{{.MemUsage}}}} {CONTAINER}")
        try:
            usage = int(float(stats.split("/")[0].strip().rstrip("GiBmiBkKB")) * (1 << 30))
            src = "docker-stats"
        except Exception:
            usage = None
    if usage is None:
        log("WARN tidak bisa membaca penggunaan memori aktual")
        return 0

    tracked = ch_tracked_mem()
    ratio = usage / limit
    info = (f"rss={usage / 2**30:.2f}GiB limit={limit / 2**30:.0f}GiB "
            f"({ratio:.0%}) tracked={tracked / 2**20 if tracked else None}MiB src={src}")

    try:
        state = json.load(open(STATE))
    except Exception:
        state = {}

    if ratio < THRESHOLD:
        if state.get("strikes"):
            log(f"OK memori turun ke {ratio:.0%} — strike direset ({info})")
        json.dump({"strikes": 0, "last_ok": dt.datetime.now(dt.timezone.utc).isoformat()},
                  open(STATE, "w"))
        return 0

    strikes = int(state.get("strikes", 0)) + 1
    log(f"WARN memori proses {ratio:.0%} ({info}), strike {strikes}")

    if strikes < 2:
        json.dump({"strikes": strikes}, open(STATE, "w"))
        return 0

    if DRY_RUN:
        log("DRY-RUN: ACTION restart dilewati (flag aktif)")
        json.dump({"strikes": strikes}, open(STATE, "w"))
        return 0

    log("ACTION restart ClickHouse terkontrol (RSS >=80% limit 2x berturut-turut)")
    out = sh(f"docker restart {CONTAINER}", timeout=180)
    log(f"restart: {out[:120]}")

    status = ""
    for _ in range(24):
        status = sh(f"docker inspect {CONTAINER} --format '{{{{.State.Health.Status}}}}'")
        if status == "healthy":
            break
        time.sleep(5)
    tracked_after = ch_tracked_mem()
    log(f"selesai: health={status} tracked={tracked_after}MiB")
    json.dump({"strikes": 0,
               "last_restart": dt.datetime.now(dt.timezone.utc).isoformat()},
              open(STATE, "w"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
