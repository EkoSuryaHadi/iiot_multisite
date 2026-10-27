from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.mysql_buffer import mysql_telemetry_buffer


@pytest.mark.asyncio
async def test_ingest_telemetry_dual_writes_to_mysql(monkeypatch):
    mysql_rows = []

    async def mock_mysql_add(record):
        mysql_rows.append(record)

    monkeypatch.setattr(mysql_telemetry_buffer, "add", mock_mysql_add)

    payload = {
        "topic": "t/tenant-a/s/site-a/d/dev-1/telemetry",
        "payload": {"Voltage": 220.5, "Current": 10.2, "Power": 2249.1, "daily_energy": 55.4},
        "publish_received_at": 1700000000000,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ingest",
            json=payload,
            headers={"X-Ingest-Secret": "change_me_ingest_secret"},
        )

    assert resp.status_code == 200
    assert len(mysql_rows) == 1
    rec = mysql_rows[0]
    assert rec["device_id"] == "dev-1"
    assert rec["tenant_slug"] == "tenant-a"
    assert rec["site_slug"] == "site-a"
    assert rec["voltage"] == 220.5
    assert rec["current"] == 10.2
    assert rec["power"] == 2249.1
    assert rec["energy"] == 55.4
