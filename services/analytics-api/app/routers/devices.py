from fastapi import APIRouter, Depends, Query, Request

from app.config import settings
from app.deps import CurrentUser, get_current_user, resolve_tenant_scope
from app.device_counts import resolve_device_states
from app.rate_limit import limiter
from app.schemas import DeviceStatusListResponse, DeviceStatusOut

router = APIRouter(tags=["devices"])

DEFAULT_ONLINE_THRESHOLD_SECONDS = 300


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

    # Penggabungan registry PostgreSQL + last_seen ClickHouse terjadi di sini, jadi
    # pagination dilakukan setelah merge agar device yang belum pernah mengirim
    # telemetry tidak terlewat.
    states = resolve_device_states(effective_tenant, site_slug, online_threshold_seconds)
    window = states[offset : offset + limit + 1]
    has_more = len(window) > limit

    devices = [DeviceStatusOut(**state) for state in window[:limit]]
    return DeviceStatusListResponse(
        limit=limit, offset=offset, has_more=has_more, devices=devices
    )
