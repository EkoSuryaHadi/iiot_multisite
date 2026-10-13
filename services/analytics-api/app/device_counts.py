"""Query bersama untuk menghitung status online/offline device, dipakai oleh
router /devices/status dan /summary/*.
"""
from app.clickhouse_client import get_client

_LAST_SEEN_SQL = """
    SELECT device_key, max(last_seen) AS last_seen
    FROM (
        SELECT device_key, max(ts) AS last_seen
        FROM telemetry
        WHERE tenant_slug = {tenant_slug:String} {site_filter}
        GROUP BY device_key
        UNION ALL
        SELECT device_key, max(ts) AS last_seen
        FROM device_status
        WHERE tenant_slug = {tenant_slug:String} {site_filter}
        GROUP BY device_key
    )
    GROUP BY device_key
"""


def count_online_offline(tenant_slug: str, site_slug: str | None, online_threshold_seconds: int) -> tuple[int, int]:
    client = get_client()
    params = {"tenant_slug": tenant_slug}
    site_filter = ""
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND site_slug = {site_slug:String}"

    sql = _LAST_SEEN_SQL.replace("{site_filter}", site_filter)
    result = client.query(sql, parameters=params)
    now = client.query("SELECT now()").result_rows[0][0]

    online = 0
    offline = 0
    for _device_key, last_seen in result.result_rows:
        age_seconds = (now - last_seen).total_seconds()
        if age_seconds <= online_threshold_seconds:
            online += 1
        else:
            offline += 1
    return online, offline
