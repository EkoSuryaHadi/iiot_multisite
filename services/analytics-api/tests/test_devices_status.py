from datetime import datetime, timedelta, timezone

from tests.conftest import make_token


async def test_online_and_offline_classification(client, ch_client, tenant_a):
    now = datetime.now(timezone.utc)
    ch_client.insert(
        "telemetry",
        [
            ("acme", "jkt", "gw-online", "temp", 20.0, now - timedelta(seconds=10), ""),
            ("acme", "jkt", "gw-offline", "temp", 20.0, now - timedelta(seconds=9999), ""),
        ],
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = make_token(tenant_a.id, "viewer")
    resp = await client.get("/devices/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    devices = {d["device_key"]: d["status"] for d in resp.json()["devices"]}
    assert devices["gw-online"] == "online"
    assert devices["gw-offline"] == "offline"


async def test_devices_status_tenant_isolation(client, ch_client, tenant_a, tenant_b):
    now = datetime.now(timezone.utc)
    ch_client.insert(
        "telemetry",
        [("beta", "jkt", "gw-01", "temp", 20.0, now, "")],
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = make_token(tenant_a.id, "viewer")
    resp = await client.get("/devices/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["devices"] == []
