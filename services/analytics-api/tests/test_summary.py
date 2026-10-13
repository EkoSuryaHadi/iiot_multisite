from datetime import datetime, timedelta, timezone

from tests.conftest import make_token


async def test_summary_tenant(client, ch_client, tenant_a):
    now = datetime.now(timezone.utc)
    ch_client.insert(
        "telemetry",
        [
            ("acme", "jkt", "gw-01", "temp", 20.0, now - timedelta(seconds=5), ""),
            ("acme", "jkt", "gw-01", "temp", 22.0, now - timedelta(seconds=3), ""),
            ("acme", "bdg", "gw-02", "temp", 30.0, now - timedelta(seconds=9999), ""),
        ],
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = make_token(tenant_a.id, "tenant_admin")
    resp = await client.get(
        "/summary/tenant",
        params={"start": (now - timedelta(hours=1)).isoformat(), "end": (now + timedelta(hours=1)).isoformat()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tenant_slug"] == "acme"
    assert body["device_count"] == 2
    assert body["online_count"] == 1
    assert body["offline_count"] == 1
    # Baris gw-02 (9999 detik lalu) di luar window waktu metrik (start=now-1h), jadi tidak terhitung di metrics -
    # meski devicenya tetap terhitung "offline" di device_count karena online/offline tidak dibatasi window.
    metric = next(m for m in body["metrics"] if m["metric_name"] == "temp")
    assert metric["count"] == 2
    assert metric["min"] == 20.0
    assert metric["max"] == 22.0


async def test_summary_site_scoped(client, ch_client, tenant_a):
    now = datetime.now(timezone.utc)
    ch_client.insert(
        "telemetry",
        [
            ("acme", "jkt", "gw-01", "temp", 20.0, now, ""),
            ("acme", "bdg", "gw-02", "temp", 99.0, now, ""),
        ],
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = make_token(tenant_a.id, "tenant_admin")
    resp = await client.get(
        "/summary/site",
        params={
            "site_slug": "jkt",
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["site_slug"] == "jkt"
    assert body["device_count"] == 1
    metric = next(m for m in body["metrics"] if m["metric_name"] == "temp")
    assert metric["count"] == 1
    assert metric["avg"] == 20.0
