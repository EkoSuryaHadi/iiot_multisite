import json

from fastapi import APIRouter, HTTPException, status

from app.buffer import device_status_buffer, telemetry_buffer
from app.ingest_logic import coerce_payload_to_dict, extract_numeric_metrics, resolve_timestamp
from app.schemas import IngestRequest, IngestResponse
from app.topics import STATUS_SUFFIX, TELEMETRY_SUFFIX, parse_device_topic

router = APIRouter(tags=["ingest"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest(payload: IngestRequest) -> IngestResponse:
    parsed_topic = parse_device_topic(payload.topic)
    if parsed_topic is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Topik tidak valid: {payload.topic}")

    body = coerce_payload_to_dict(payload.payload)
    if body is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload bukan JSON object yang valid")

    ts = resolve_timestamp(body, payload.publish_received_at)
    raw_payload = json.dumps(body, separators=(",", ":"))

    if parsed_topic.suffix == TELEMETRY_SUFFIX:
        metrics = extract_numeric_metrics(body)
        for metric_name, metric_value in metrics:
            await telemetry_buffer.add(
                (
                    parsed_topic.tenant_slug,
                    parsed_topic.site_slug,
                    parsed_topic.device_key,
                    metric_name,
                    metric_value,
                    ts,
                    raw_payload,
                )
            )
        return IngestResponse(accepted=True, rows_buffered=len(metrics))

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
