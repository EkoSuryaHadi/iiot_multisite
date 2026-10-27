import asyncio
from datetime import datetime, timezone
from app.mysql_buffer import AsyncMySQLBatchBuffer, flatten_telemetry_for_mysql


def test_flatten_telemetry_for_mysql():
    ts = datetime(2026, 10, 26, 12, 0, 0, tzinfo=timezone.utc)
    metrics = [
        ("v_pv", 220.5),
        ("i_pv", 10.2),
        ("p_pv", 2249.1),
        ("energy", 45.6),
        ("temp_mppt", 38.5),
        ("frequency", 50.0),
        ("power_factor", 0.98),
    ]
    raw = '{"Voltage": 220.5, "Current": 10.2, "Power": 2249.1}'

    record = flatten_telemetry_for_mysql(
        tenant_slug="mitra",
        site_slug="site-a",
        device_key="gw-01",
        ts=ts,
        metrics=metrics,
        raw_payload=raw,
    )

    assert record["ts"] == ts
    assert record["device_id"] == "gw-01"
    assert record["tenant_slug"] == "mitra"
    assert record["site_slug"] == "site-a"
    assert record["voltage"] == 220.5
    assert record["current"] == 10.2
    assert record["power"] == 2249.1
    assert record["energy"] == 45.6
    assert record["temperature"] == 38.5
    assert record["frequency"] == 50.0
    assert record["power_factor"] == 0.98
    assert record["raw_payload"] == raw


def test_mysql_buffer_batching_and_retry(monkeypatch):
    async def _test():
        buf = AsyncMySQLBatchBuffer(
            batch_size=5,
            flush_interval=100.0,
            max_buffered_rows=20,
        )

        inserted_batches = []
        fail_once = {"failed": False}

        def mock_insert(rows):
            if not fail_once["failed"]:
                fail_once["failed"] = True
                raise ConnectionError("MySQL connection lost")
            inserted_batches.extend(rows)

        monkeypatch.setattr(buf, "_insert_sync", mock_insert)

        record1 = {
            "ts": datetime.now(timezone.utc),
            "device_id": "d1",
            "tenant_slug": "t1",
            "site_slug": "s1",
            "voltage": 220.0,
            "current": 5.0,
            "power": 1100.0,
            "energy": 10.0,
            "frequency": 50.0,
            "power_factor": 1.0,
            "temperature": 30.0,
            "raw_payload": "{}",
        }

        await buf.add(record1)
        # Flush 1: gagal, baris tetap ada di antrean
        flushed = await buf.flush()
        assert flushed == 0
        assert len(buf._rows) == 1

        # Flush 2: sukses, baris ter-insert
        flushed = await buf.flush()
        assert flushed == 1
        assert len(buf._rows) == 0
        assert len(inserted_batches) == 1

    asyncio.run(_test())
