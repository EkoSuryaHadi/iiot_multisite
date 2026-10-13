import json
from datetime import datetime, timezone
from typing import Any


def coerce_payload_to_dict(payload: Any) -> dict | None:
    """payload dari EMQX bisa berupa JSON string atau sudah berupa object/dict."""
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, str):
        try:
            parsed = json.loads(payload)
        except (ValueError, TypeError):
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def resolve_timestamp(payload: dict, publish_received_at: int | None) -> datetime:
    """Urutan prioritas: field `ts` di payload (detik/milidetik epoch) -> waktu
    diterima EMQX (`publish_received_at`, milidetik) -> waktu sekarang.
    """
    ts_value = payload.get("ts")
    if isinstance(ts_value, (int, float)):
        return _epoch_to_datetime(ts_value)

    if publish_received_at is not None:
        return _epoch_to_datetime(publish_received_at)

    return datetime.now(timezone.utc)


def _epoch_to_datetime(value: float) -> datetime:
    # Heuristik: epoch detik ~1.7e9, epoch milidetik ~1.7e12.
    if value > 10**12:
        value = value / 1000.0
    return datetime.fromtimestamp(value, tz=timezone.utc)


def extract_numeric_metrics(payload: dict) -> list[tuple[str, float]]:
    metrics: list[tuple[str, float]] = []
    for key, value in payload.items():
        if key == "ts":
            continue
        if isinstance(value, bool):
            continue  # bool adalah subclass int di Python - jangan dianggap metrik numerik
        if isinstance(value, (int, float)):
            metrics.append((key, float(value)))
    return metrics
