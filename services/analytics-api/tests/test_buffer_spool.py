import asyncio

import pytest

from app import clickhouse_client as ch
from app.buffer import AsyncBatchBuffer


class Recorder:
    def __init__(self):
        self.fail = True
        self.rows = []

    def insert_rows(self, table, rows, column_names=None):
        if self.fail:
            raise RuntimeError("simulasi ClickHouse mati")
        self.rows.extend(rows)


def make_buf(tmp_path, monkeypatch, *, flush_interval=0.01, backoff_max=0.05):
    rec = Recorder()
    monkeypatch.setattr(ch, "insert_rows", rec.insert_rows)
    buf = AsyncBatchBuffer(
        "telemetry", ["a", "b"], batch_size=3, flush_interval=flush_interval,
        spool_dir=str(tmp_path), spool_max_bytes=1024 * 1024,
        backoff_max_seconds=backoff_max, ts_index=None,
    )
    return buf, rec


def spool_lines(tmp_path):
    return sum(len(p.read_text().splitlines()) for p in tmp_path.glob("*.jsonl"))


@pytest.mark.asyncio
async def test_spool_saat_clickhouse_mati(tmp_path, monkeypatch):
    buf, rec = make_buf(tmp_path, monkeypatch)
    for i in range(7):
        await buf.add((i, "x"))
    await asyncio.sleep(0.05)
    await buf.flush()
    assert spool_lines(tmp_path) == 7      # tidak ada yang hilang
    assert rec.rows == []


@pytest.mark.asyncio
async def test_drain_setelah_pulih(tmp_path, monkeypatch):
    buf, rec = make_buf(tmp_path, monkeypatch)
    for i in range(7):
        await buf.add((i, "x"))
    await asyncio.sleep(0.05)
    await buf.flush()                       # gagal -> masuk spool
    assert spool_lines(tmp_path) == 7
    rec.fail = False
    buf._next_try_at = 0.0                  # backoff berakhir (deterministik)
    await buf.flush()                       # pulih -> drain
    assert len(rec.rows) == 7
    assert spool_lines(tmp_path) == 0


@pytest.mark.asyncio
async def test_backoff_menahan_flush(tmp_path, monkeypatch):
    buf, rec = make_buf(tmp_path, monkeypatch, flush_interval=1.0, backoff_max=60.0)
    for i in range(3):
        await buf.add((i, "x"))
    await buf.flush()                       # gagal -> backoff ~2 dtk
    assert spool_lines(tmp_path) == 3
    rec.fail = False
    n = await buf.flush()                   # masih dalam backoff -> 0
    assert n == 0
    assert spool_lines(tmp_path) == 3
    buf._next_try_at = 0.0                  # lewati backoff secara eksplisit
    await buf.flush()                       # drain spool
    assert len(rec.rows) == 3
    assert spool_lines(tmp_path) == 0
