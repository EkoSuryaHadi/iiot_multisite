import asyncio
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.mysql_sink import MySQLTelemetrySink


@pytest.mark.asyncio
async def test_mysql_sink_disabled_by_default():
    sink = MySQLTelemetrySink()
    assert sink.enabled is False
    # Menambahkan data saat disabled tidak mengubah antrean
    await sink.add(("tenant1", "site1", "dev1", "temp", 25.0, datetime.now(timezone.utc), "{}"))
    assert len(sink._rows) == 0


@pytest.mark.asyncio
async def test_mysql_sink_tenant_filtering(monkeypatch):
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_enabled", True)
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_tenant_slug", "cust-acme")
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_batch_size", 100)

    sink = MySQLTelemetrySink()
    assert sink.enabled is True
    assert sink.is_target_tenant("cust-acme") is True
    assert sink.is_target_tenant("other-tenant") is False

    now = datetime.now(timezone.utc)
    # Tambah row dari tenant lain -> diabaikan
    await sink.add(("other-tenant", "site1", "dev1", "temp", 25.0, now, "{}"))
    assert len(sink._rows) == 0

    # Tambah row dari target tenant -> masuk buffer
    await sink.add(("cust-acme", "site1", "dev1", "temp", 26.5, now, "{}"))
    assert len(sink._rows) == 1
    assert sink._rows[0][0] == "cust-acme"


@pytest.mark.asyncio
async def test_mysql_sink_flush_and_table_creation(monkeypatch):
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_enabled", True)
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_tenant_slug", "cust-acme")
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_table", "user_telemetry")

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    sink = MySQLTelemetrySink()
    sink._get_connection = MagicMock(return_value=mock_conn)

    now = datetime.now(timezone.utc)
    await sink.add(("cust-acme", "site-1", "gw-01", "v_pv", 54.2, now, '{"v_pv": 54.2}'))

    flushed = await sink.flush()
    assert flushed == 1
    assert len(sink._rows) == 0

    # Pastikan CREATE TABLE dieksekusi pertama kali
    executed_statements = [call[0][0] for call in mock_cursor.execute.call_args_list]
    assert any("CREATE TABLE IF NOT EXISTS `user_telemetry`" in stmt for stmt in executed_statements)

    # Pastikan executemany dipanggil untuk INSERT
    mock_cursor.executemany.assert_called_once()
    insert_sql, params = mock_cursor.executemany.call_args[0]
    assert "INSERT INTO `user_telemetry`" in insert_sql
    assert len(params) == 1
    assert params[0][0] == "cust-acme"
    assert params[0][3] == "v_pv"
    assert params[0][4] == 54.2


@pytest.mark.asyncio
async def test_mysql_sink_retry_on_failure(monkeypatch):
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_enabled", True)
    monkeypatch.setattr("app.mysql_sink.settings.mysql_sink_tenant_slug", "cust-acme")

    sink = MySQLTelemetrySink()
    # Mock error saat insert
    sink._insert_batch_sync = MagicMock(side_effect=Exception("Connection refused / network timeout"))

    now = datetime.now(timezone.utc)
    await sink.add(("cust-acme", "site-1", "gw-01", "temp", 30.0, now, "{}"))
    assert len(sink._rows) == 1

    # Flush gagal -> data harus tetap ada di antrean untuk retry berikutnya
    flushed = await sink.flush()
    assert flushed == 0
    assert len(sink._rows) == 1

