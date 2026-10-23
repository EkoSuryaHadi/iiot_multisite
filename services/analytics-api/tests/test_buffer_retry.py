import asyncio
from app.buffer import AsyncBatchBuffer


def test_buffer_retries_failed_rows(monkeypatch):
    async def _test():
        buf = AsyncBatchBuffer(
            table="test_table",
            column_names=["col1"],
            batch_size=10,
            flush_interval=100.0,
            max_buffered_rows=100,
        )

        attempt = {"count": 0}
        inserted_rows = []

        def mock_insert(rows):
            attempt["count"] += 1
            if attempt["count"] == 1:
                raise ConnectionError("Simulated database timeout")
            inserted_rows.extend(rows)

        monkeypatch.setattr(buf, "_insert", mock_insert)

        await buf.add(("row_1",))
        await buf.add(("row_2",))

        # Percobaan 1: Gagal, baris tidak dibuang melainkan dikembalikan ke antrean
        flushed = await buf.flush()
        assert flushed == 0
        assert len(buf._rows) == 2

        # Percobaan 2: Sukses, baris berhasil di-insert
        flushed = await buf.flush()
        assert flushed == 2
        assert len(buf._rows) == 0
        assert inserted_rows == [("row_1",), ("row_2",)]

    asyncio.run(_test())


def test_buffer_drops_oldest_when_exceeding_max_capacity(monkeypatch):
    async def _test():
        buf = AsyncBatchBuffer(
            table="test_table",
            column_names=["col1"],
            batch_size=10,
            flush_interval=100.0,
            max_buffered_rows=3,
        )

        def mock_failing_insert(rows):
            raise ConnectionError("DB down")

        monkeypatch.setattr(buf, "_insert", mock_failing_insert)

        # Tambahkan 5 baris
        for i in range(5):
            await buf.add((f"row_{i}",))

        # Saat flush gagal, buffer membatasi kapasitas ke 3 baris terbaru (membuang row_0 dan row_1)
        await buf.flush()
        assert len(buf._rows) == 3
        assert buf._rows == [("row_2",), ("row_3",), ("row_4",)]

    asyncio.run(_test())
