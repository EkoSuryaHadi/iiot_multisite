from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.clickhouse_client import get_client
from app.config import settings
from app.deps import CurrentUser, get_current_user, resolve_tenant_scope
from app.rate_limit import limiter
from app.schemas import TelemetryPoint, TelemetryResponse

router = APIRouter(tags=["telemetry"])

_AGG_TABLE = {"1m": "telemetry_agg_1m", "1h": "telemetry_agg_1h"}


@router.get("/telemetry", response_model=TelemetryResponse)
@limiter.limit(settings.rate_limit)
def get_telemetry(
    request: Request,
    device_key: str,
    metric_name: str,
    start: datetime,
    end: datetime,
    site_slug: str | None = None,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    interval: Literal["raw", "1m", "1h"] = "raw",
    limit: int = Query(default=settings.default_page_size, gt=0, le=settings.max_page_size),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
) -> TelemetryResponse:
    if end <= start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="`end` harus lebih besar dari `start`")

    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    client = get_client()

    params = {
        "tenant_slug": effective_tenant,
        "device_key": device_key,
        "metric_name": metric_name,
        "start": start,
        "end": end,
        "limit": limit + 1,  # ambil 1 ekstra untuk deteksi has_more
        "offset": offset,
    }
    site_filter = ""
    if site_slug:
        params["site_slug"] = site_slug
        site_filter = "AND site_slug = {site_slug:String}"

    if interval == "raw":
        sql = f"""
            SELECT ts, metric_value AS value
            FROM telemetry
            WHERE tenant_slug = {{tenant_slug:String}}
              AND device_key = {{device_key:String}}
              AND metric_name = {{metric_name:String}}
              {site_filter}
              AND ts >= {{start:DateTime64(3)}} AND ts < {{end:DateTime64(3)}}
            ORDER BY ts
            LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}
        """
        result = client.query(sql, parameters=params)
        points = [TelemetryPoint(ts=row[0], value=row[1]) for row in result.result_rows]
    else:
        table = _AGG_TABLE[interval]
        sql = f"""
            SELECT bucket AS ts,
                   avgMerge(avg_value) AS avg_value,
                   minMerge(min_value) AS min_value,
                   maxMerge(max_value) AS max_value,
                   countMerge(sample_count) AS sample_count
            FROM {table}
            WHERE tenant_slug = {{tenant_slug:String}}
              AND device_key = {{device_key:String}}
              AND metric_name = {{metric_name:String}}
              {site_filter}
              AND bucket >= {{start:DateTime64(3)}} AND bucket < {{end:DateTime64(3)}}
            GROUP BY bucket
            ORDER BY bucket
            LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}
        """
        result = client.query(sql, parameters=params)
        points = [
            TelemetryPoint(ts=row[0], avg=row[1], min=row[2], max=row[3], count=row[4])
            for row in result.result_rows
        ]

    has_more = len(points) > limit
    points = points[:limit]

    return TelemetryResponse(
        tenant_slug=effective_tenant,
        site_slug=site_slug,
        device_key=device_key,
        metric_name=metric_name,
        interval=interval,
        limit=limit,
        offset=offset,
        has_more=has_more,
        points=points,
    )
