from datetime import datetime, timedelta, timezone

from starlette.requests import Request

from app.rate_limit import get_rate_limit_key
from tests.conftest import make_token


async def _seed_telemetry(ch_client, tenant_slug, site_slug, device_key, metric_name, points):
    rows = [
        (tenant_slug, site_slug, device_key, metric_name, value, ts, "")
        for ts, value in points
    ]
    ch_client.insert(
        "telemetry",
        rows,
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )


async def test_viewer_can_query_own_tenant_raw_telemetry(client, ch_client, tenant_a):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    await _seed_telemetry(
        ch_client,
        "acme",
        "jkt",
        "gw-01",
        "temp",
        [(base, 20.0), (base + timedelta(seconds=10), 21.0), (base + timedelta(seconds=20), 22.0)],
    )

    token = make_token(tenant_a.id, "viewer")
    resp = await client.get(
        "/telemetry",
        params={
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=1)).isoformat(),
            "interval": "raw",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tenant_slug"] == "acme"
    assert len(body["points"]) == 3
    assert [p["value"] for p in body["points"]] == [20.0, 21.0, 22.0]


async def test_viewer_cannot_access_other_tenant_data(client, ch_client, tenant_a, tenant_b):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    await _seed_telemetry(ch_client, "beta", "jkt", "gw-01", "temp", [(base, 99.0)])

    token = make_token(tenant_a.id, "viewer")  # token tenant acme, data milik beta
    resp = await client.get(
        "/telemetry",
        params={
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["points"] == []  # tidak ada data karena tenant_slug dipaksa ke 'acme'


async def test_superadmin_must_specify_tenant_slug(client, ch_client, tenant_a):
    token = make_token(None, "superadmin")
    resp = await client.get(
        "/telemetry",
        params={
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": "2026-01-01T00:00:00Z",
            "end": "2026-01-01T01:00:00Z",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_superadmin_can_query_any_tenant(client, ch_client, tenant_a, tenant_b):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    await _seed_telemetry(ch_client, "beta", "jkt", "gw-01", "temp", [(base, 15.5)])

    token = make_token(None, "superadmin")
    resp = await client.get(
        "/telemetry",
        params={
            "tenant_slug": "beta",
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["points"][0]["value"] == 15.5


async def test_telemetry_requires_auth(client, ch_client):
    resp = await client.get(
        "/telemetry",
        params={"device_key": "gw-01", "metric_name": "temp", "start": "2026-01-01T00:00:00Z", "end": "2026-01-01T01:00:00Z"},
    )
    assert resp.status_code == 401


async def test_telemetry_pagination_has_more(client, ch_client, tenant_a):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    points = [(base + timedelta(seconds=i), float(i)) for i in range(5)]
    await _seed_telemetry(ch_client, "acme", "jkt", "gw-01", "temp", points)

    token = make_token(tenant_a.id, "viewer")
    resp = await client.get(
        "/telemetry",
        params={
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=1)).isoformat(),
            "limit": 2,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    body = resp.json()
    assert len(body["points"]) == 2
    assert body["has_more"] is True


async def test_telemetry_aggregated_1m_interval(client, ch_client, tenant_a):
    base = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    points = [(base + timedelta(seconds=i * 5), 10.0 + i) for i in range(6)]  # dalam menit yg sama
    await _seed_telemetry(ch_client, "acme", "jkt", "gw-01", "temp", points)
    ch_client.command("OPTIMIZE TABLE telemetry_agg_1m FINAL")

    token = make_token(tenant_a.id, "viewer")
    resp = await client.get(
        "/telemetry",
        params={
            "device_key": "gw-01",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=5)).isoformat(),
            "interval": "1m",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["points"]) == 1
    point = body["points"][0]
    assert point["count"] == 6
    assert point["min"] == 10.0
    assert point["max"] == 15.0


def test_rate_limit_key_uses_jwt_sub_and_forwarded_for(tenant_a):
    token1 = make_token(tenant_a.id, "viewer")
    token2 = make_token(tenant_a.id, "viewer")

    req1 = Request(
        {
            "type": "http",
            "headers": [(b"authorization", f"Bearer {token1}".encode())],
            "client": ("172.18.0.10", 50000),
        }
    )
    req2 = Request(
        {
            "type": "http",
            "headers": [(b"authorization", f"Bearer {token2}".encode())],
            "client": ("172.18.0.10", 50000),
        }
    )
    assert get_rate_limit_key(req1).startswith("user:")
    assert get_rate_limit_key(req2).startswith("user:")
    assert get_rate_limit_key(req1) != get_rate_limit_key(req2)

    req_xff = Request(
        {
            "type": "http",
            "headers": [(b"x-forwarded-for", b"203.0.113.5, 172.18.0.10")],
            "client": ("172.18.0.10", 50000),
        }
    )
    assert get_rate_limit_key(req_xff) == "ip:203.0.113.5"
