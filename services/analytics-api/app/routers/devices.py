from fastapi import APIRouter, Depends, Query, Request

from app.clickhouse_client import get_client
from app.config import settings
from app.deps import CurrentUser, get_current_user, resolve_tenant_scope
from app.rate_limit import limiter
from app.schemas import DeviceStatusListResponse, DeviceStatusOut

router = APIRouter(tags=["devices"])

DEFAULT_ONLINE_THRESHOLD_SECONDS = 300

_DEVICES_STATUS_SQL = """
    SELECT tenant_slug, site_slug, device_key, status, last_seen
    FROM device_last_seen FINAL
    WHERE tenant_slug = {tenant_slug:String} {site_filter}
    ORDER BY tenant_slug, site_slug, device_key
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
"""


@router.get("/devices/status", response_model=DeviceStatusListResponse)
@limiter.limit(settings.rate_limit)
def list_device_status(
    request: Request,
    site_slug: str | None = None,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    online_threshold_seconds: int = Query(default=DEFAULT_ONLINE_THRESHOLD_SECONDS, gt=0),
    limit: int = Query(default=settings.default_page_size, gt=0, le=settings.max_page_size),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
) -> DeviceStatusListResponse:
    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    client = get_client()

    site_filter = ""
    params = {"tenant_slug": effective_tenant, "limit": limit + 1, "offset": offset}
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND site_slug = {site_slug:String}"

    sql = _DEVICES_STATUS_SQL.replace("{site_filter}", site_filter)
    result = client.query(sql, parameters=params)

    now = client.query("SELECT now()").result_rows[0][0]
    devices = []
    for tenant_slug_row, site_slug_row, device_key_row, status_row, last_seen in result.result_rows:
        age_seconds = (now - last_seen).total_seconds()
        status_value = "online" if (age_seconds <= online_threshold_seconds and status_row != "offline") else "offline"
        devices.append(
            DeviceStatusOut(
                tenant_slug=tenant_slug_row,
                site_slug=site_slug_row,
                device_key=device_key_row,
                status=status_value,
                last_seen=last_seen,
            )
        )

    has_more = len(devices) > limit
    devices = devices[:limit]

    return DeviceStatusListResponse(limit=limit, offset=offset, has_more=has_more, devices=devices)
