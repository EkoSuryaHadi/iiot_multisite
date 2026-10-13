from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request

from app.clickhouse_client import get_client
from app.config import settings
from app.deps import CurrentUser, get_current_user, resolve_tenant_scope
from app.device_counts import count_online_offline
from app.rate_limit import limiter
from app.schemas import MetricSummary, SiteSummary, TenantSummary

router = APIRouter(tags=["summary"])

DEFAULT_WINDOW_MINUTES = 60
DEFAULT_ONLINE_THRESHOLD_SECONDS = 300

_METRICS_SQL = """
    SELECT metric_name, avg(metric_value), min(metric_value), max(metric_value), count()
    FROM telemetry
    WHERE tenant_slug = {tenant_slug:String} {site_filter}
      AND ts >= {start:DateTime64(3)} AND ts < {end:DateTime64(3)}
    GROUP BY metric_name
    ORDER BY metric_name
"""


def _query_metrics(tenant_slug: str, site_slug: str | None, start: datetime, end: datetime) -> list[MetricSummary]:
    client = get_client()
    params = {"tenant_slug": tenant_slug, "start": start, "end": end}
    site_filter = ""
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND site_slug = {site_slug:String}"

    result = client.query(_METRICS_SQL.replace("{site_filter}", site_filter), parameters=params)
    return [
        MetricSummary(metric_name=row[0], avg=row[1], min=row[2], max=row[3], count=row[4])
        for row in result.result_rows
    ]


def _default_window(start: datetime | None, end: datetime | None) -> tuple[datetime, datetime]:
    if end is None:
        end = datetime.now(timezone.utc)
    if start is None:
        start = end - timedelta(minutes=DEFAULT_WINDOW_MINUTES)
    return start, end


@router.get("/summary/tenant", response_model=TenantSummary)
@limiter.limit(settings.rate_limit)
def summary_tenant(
    request: Request,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    start: datetime | None = None,
    end: datetime | None = None,
    online_threshold_seconds: int = Query(default=DEFAULT_ONLINE_THRESHOLD_SECONDS, gt=0),
    current_user: CurrentUser = Depends(get_current_user),
) -> TenantSummary:
    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    start, end = _default_window(start, end)

    metrics = _query_metrics(effective_tenant, None, start, end)
    online, offline = count_online_offline(effective_tenant, None, online_threshold_seconds)

    return TenantSummary(
        tenant_slug=effective_tenant,
        device_count=online + offline,
        online_count=online,
        offline_count=offline,
        metrics=metrics,
    )


@router.get("/summary/site", response_model=SiteSummary)
@limiter.limit(settings.rate_limit)
def summary_site(
    request: Request,
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    start: datetime | None = None,
    end: datetime | None = None,
    online_threshold_seconds: int = Query(default=DEFAULT_ONLINE_THRESHOLD_SECONDS, gt=0),
    current_user: CurrentUser = Depends(get_current_user),
) -> SiteSummary:
    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    start, end = _default_window(start, end)

    metrics = _query_metrics(effective_tenant, site_slug, start, end)
    online, offline = count_online_offline(effective_tenant, site_slug, online_threshold_seconds)

    return SiteSummary(
        tenant_slug=effective_tenant,
        site_slug=site_slug,
        device_count=online + offline,
        online_count=online,
        offline_count=offline,
        metrics=metrics,
    )
