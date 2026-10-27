import hmac
import json

from fastapi import APIRouter, Header, HTTPException, status

from app.buffer import device_status_buffer, telemetry_buffer
from app.config import settings
from app.ingest_logic import (
    coerce_payload_to_dict,
    extract_buffered_records,
    resolve_timestamp,
)
from app.mysql_buffer import flatten_telemetry_for_mysql, mysql_telemetry_buffer
from app.schemas import IngestRequest, IngestResponse
from app.topics import STATUS_SUFFIX, TELEMETRY_SUFFIX, parse_device_topic

router = APIRouter(tags=["ingest"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    payload: IngestRequest,
    x_ingest_secret: str | None = Header(default=None, alias="X-Ingest-Secret"),
) -> IngestResponse:
    if settings.ingest_secret:
        if not x_ingest_secret or not hmac.compare_digest(x_ingest_secret, settings.ingest_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Header X-Ingest-Secret tidak valid atau tidak disertakan",
            )

    parsed_topic = parse_device_topic(payload.topic)
    if parsed_topic is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Topik tidak valid: {payload.topic}")

    body = coerce_payload_to_dict(payload.payload)
    if body is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload bukan JSON object yang valid")

    if parsed_topic.suffix == TELEMETRY_SUFFIX:
        records = extract_buffered_records(body, payload.publish_received_at)
        rows_buffered = 0
        for rec_ts, metrics, rec_raw in records:
            # Forward flat telemetry ke MySQL
            mysql_rec = flatten_telemetry_for_mysql(
                parsed_topic.tenant_slug,
                parsed_topic.site_slug,
                parsed_topic.device_key,
                rec_ts,
                metrics,
                rec_raw,
            )
            await mysql_telemetry_buffer.add(mysql_rec)

            for metric_name, metric_value in metrics:
                await telemetry_buffer.add(
                    (
                        parsed_topic.tenant_slug,
                        parsed_topic.site_slug,
                        parsed_topic.device_key,
                        metric_name,
                        metric_value,
                        rec_ts,
                        rec_raw,
                    )
                )
                rows_buffered += 1
        return IngestResponse(accepted=True, rows_buffered=rows_buffered)

    ts = resolve_timestamp(body, payload.publish_received_at)
    raw_payload = json.dumps(body, separators=(",", ":"))

    if parsed_topic.suffix == STATUS_SUFFIX:
        status_value = body.get("status")
        if not isinstance(status_value, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Payload status harus punya field 'status' (string)"
            )
        await device_status_buffer.add(
            (
                parsed_topic.tenant_slug,
                parsed_topic.site_slug,
                parsed_topic.device_key,
                status_value,
                ts,
                raw_payload,
            )
        )
        return IngestResponse(accepted=True, rows_buffered=1)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail=f"Suffix topik tidak didukung untuk ingest: {parsed_topic.suffix}"
    )
