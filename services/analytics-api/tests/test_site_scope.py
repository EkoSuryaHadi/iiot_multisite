import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.cache import site_slug_cache
from app.config import settings
from app.models_pg import Site


def _make_site_token(tenant_id: uuid.UUID, site_id: uuid.UUID, role: str = "viewer") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "tenant_id": str(tenant_id),
        "site_id": str(site_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now.replace(year=now.year + 1),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def test_site_scoped_user_only_reads_own_site_telemetry(client, ch_client, pg_session, tenant_a):
    site_slug_cache.clear()
    site1 = Site(id=uuid.uuid4(), tenant_id=tenant_a.id, slug="jkt", is_active=True)
    site2 = Site(id=uuid.uuid4(), tenant_id=tenant_a.id, slug="bdg", is_active=True)
    pg_session.add_all([site1, site2])
    pg_session.commit()

    base = datetime(2026, 2, 1, tzinfo=timezone.utc)
    ch_client.insert(
        "telemetry",
        [
            ("acme", "jkt", "gw-01", "temp", 25.5, base, ""),
            ("acme", "bdg", "gw-02", "temp", 31.0, base, ""),
        ],
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = _make_site_token(tenant_a.id, site1.id, "viewer")

    # Query tanpa site_slug -> otomatis di-scope ke jkt
    ok_resp = await client.get(
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
    assert ok_resp.status_code == 200, ok_resp.text
    assert ok_resp.json()["site_slug"] == "jkt"
    assert [p["value"] for p in ok_resp.json()["points"]] == [25.5]

    # Query ke site lain (bdg) -> ditolak 403 Forbidden
    forbidden_resp = await client.get(
        "/telemetry",
        params={
            "site_slug": "bdg",
            "device_key": "gw-02",
            "metric_name": "temp",
            "start": base.isoformat(),
            "end": (base + timedelta(minutes=1)).isoformat(),
            "interval": "raw",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert forbidden_resp.status_code == 403

    # Cleanup
    pg_session.query(Site).delete()
    pg_session.commit()
