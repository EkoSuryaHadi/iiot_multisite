"""Sumber tunggal status online/offline device.

Status TIDAK diambil dari kolom `status` di ClickHouse (kolom itu hanya pernah
berisi 'online' karena diisi oleh materialized view saat telemetry masuk), tetapi
dihitung dari selisih waktu `last_seen` terhadap ambang batas.

Daftar device diambil dari registry PostgreSQL (tabel `devices`) yang digabung
dengan `device_last_seen` di ClickHouse, sehingga device yang sudah didaftarkan
tapi belum pernah mengirim telemetry tetap terhitung dan tampil sebagai offline.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from app.clickhouse_client import get_client
from app.database_pg import PgSessionLocal

logger = logging.getLogger(__name__)

_LAST_SEEN_SQL = """
    SELECT site_slug, device_key, max(ts) AS last_seen
    FROM telemetry
    WHERE tenant_slug = {tenant_slug:String} {site_filter}
      AND ts > now() - INTERVAL 7 DAY
    GROUP BY site_slug, device_key
"""

# Status koneksi broker (event client_connected / client_disconnected dari EMQX).
# Dipakai untuk membedakan "device terhubung tapi belum kirim angka" dari "device mati".
_CONNECTION_SQL = """
    SELECT site_slug, device_key, argMax(status, ts) AS last_status
    FROM device_status
    WHERE tenant_slug = {tenant_slug:String} {site_filter}
    GROUP BY site_slug, device_key
"""

_REGISTERED_SQL = """
    SELECT s.slug AS site_slug, d.device_key AS device_key
    FROM devices d
    JOIN sites s ON s.id = d.site_id
    JOIN tenants t ON t.id = d.tenant_id
    WHERE t.slug = :tenant_slug
      AND d.is_active = true
      {site_filter}
"""


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _registered_devices(tenant_slug: str, site_slug: str | None) -> dict[tuple[str, str], None]:
    """Device yang terdaftar di PostgreSQL. Kegagalan DB tidak boleh mematikan endpoint."""
    site_filter = ""
    params: dict[str, str] = {"tenant_slug": tenant_slug}
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND s.slug = :site_slug"

    rows: set[tuple[str, str]] = set()
    try:
        db = PgSessionLocal()
        try:
            result = db.execute(text(_REGISTERED_SQL.format(site_filter=site_filter)), params)
            for site_row, key_row in result:
                rows.add((str(site_row), str(key_row)))
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("registry device dari PostgreSQL gagal dibaca: %s", exc)
    return {row: None for row in rows}


def resolve_device_states(
    tenant_slug: str, site_slug: str | None, online_threshold_seconds: int
) -> list[dict]:
    """Gabungan registry PostgreSQL + last_seen ClickHouse -> status per device."""
    client = get_client()
    site_filter = ""
    params: dict[str, object] = {"tenant_slug": tenant_slug}
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND site_slug = {site_slug:String}"

    seen: dict[tuple[str, str], datetime | None] = {}
    try:
        result = client.query(
            _LAST_SEEN_SQL.replace("{site_filter}", site_filter), parameters=params
        )
        for site_row, key_row, last_seen in result.result_rows:
            seen[(str(site_row), str(key_row))] = _as_utc(last_seen)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("device_last_seen dari ClickHouse gagal dibaca: %s", exc)

    now = _as_utc(client.query("SELECT now()").result_rows[0][0])

    conn: dict[tuple[str, str], str] = {}
    try:
        result = client.query(
            _CONNECTION_SQL.replace("{site_filter}", site_filter), parameters=params
        )
        for site_row, key_row, last_status in result.result_rows:
            if last_status:
                conn[(str(site_row), str(key_row))] = str(last_status).lower()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("device_status dari ClickHouse gagal dibaca: %s", exc)

    keys: set[tuple[str, str]] = set(seen)
    keys.update(_registered_devices(tenant_slug, site_slug))

    states: list[dict] = []
    for site_row, key_row in sorted(keys):
        last_seen = seen.get((site_row, key_row))
        is_online = bool(
            last_seen is not None
            and now is not None
            and (now - last_seen).total_seconds() <= online_threshold_seconds
        )
        connection = conn.get((site_row, key_row))
        if connection not in ("connected", "disconnected"):
            connection = "connected" if connection == "online" else ("disconnected" if connection == "offline" else None)
        states.append(
            {
                "tenant_slug": tenant_slug,
                "site_slug": site_row,
                "device_key": key_row,
                "status": "online" if is_online else "offline",
                "connection": connection,
                "last_seen": last_seen,
            }
        )
    return states


def count_online_offline(
    tenant_slug: str, site_slug: str | None, online_threshold_seconds: int
) -> tuple[int, int]:
    states = resolve_device_states(tenant_slug, site_slug, online_threshold_seconds)
    online = sum(1 for state in states if state["status"] == "online")
    return online, len(states) - online
