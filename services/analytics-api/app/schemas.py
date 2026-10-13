from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class IngestRequest(BaseModel):
    """Body yang dikirim EMQX Rule Engine HTTP action dari rule
    `SELECT topic, payload, clientid, timestamp AS publish_received_at FROM "t/+/s/+/d/+/telemetry"` (dan `.../status`).
    """

    topic: str
    payload: Any  # bisa berupa JSON string atau object, tergantung template EMQX
    clientid: str | None = None
    publish_received_at: int | None = None  # epoch milidetik dari ${timestamp} EMQX


class IngestResponse(BaseModel):
    accepted: bool
    rows_buffered: int
    detail: str | None = None


# --- Telemetry time-series ---
class TelemetryPoint(BaseModel):
    ts: datetime
    value: float | None = None
    avg: float | None = None
    min: float | None = None
    max: float | None = None
    count: int | None = None


class TelemetryResponse(BaseModel):
    tenant_slug: str
    site_slug: str | None = None
    device_key: str
    metric_name: str
    interval: Literal["raw", "1m", "1h"]
    limit: int
    offset: int
    has_more: bool
    points: list[TelemetryPoint]


# --- Device status ---
class DeviceStatusOut(BaseModel):
    tenant_slug: str
    site_slug: str
    device_key: str
    status: Literal["online", "offline"]
    last_seen: datetime


class DeviceStatusListResponse(BaseModel):
    limit: int
    offset: int
    has_more: bool
    devices: list[DeviceStatusOut]


# --- Summary ---
class MetricSummary(BaseModel):
    metric_name: str
    avg: float
    min: float
    max: float
    count: int


class TenantSummary(BaseModel):
    tenant_slug: str
    device_count: int
    online_count: int
    offline_count: int
    metrics: list[MetricSummary]


class SiteSummary(BaseModel):
    tenant_slug: str
    site_slug: str
    device_count: int
    online_count: int
    offline_count: int
    metrics: list[MetricSummary]
