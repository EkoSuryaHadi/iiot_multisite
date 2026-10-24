import json
from datetime import datetime, timezone
from typing import Any


def coerce_payload_to_dict(payload: Any) -> dict | list | None:
    """payload dari EMQX bisa berupa JSON string atau sudah berupa object/dict/list."""
    if isinstance(payload, (dict, list)):
        return payload
    if isinstance(payload, str):
        try:
            parsed = json.loads(payload)
        except (ValueError, TypeError):
            return None
        return parsed if isinstance(parsed, (dict, list)) else None
    return None


def resolve_timestamp(payload: Any, publish_received_at: int | None) -> datetime:
    """Urutan prioritas: field `ts` di payload (detik/milidetik epoch) -> waktu
    diterima EMQX (`publish_received_at`, milidetik) -> waktu sekarang.
    """
    if isinstance(payload, dict):
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


def extract_numeric_metrics(payload: Any) -> list[tuple[str, float]]:
    """Ekstraksi seluruh metrik numerik dari payload (mendukung flat dict, nested dict,
    numeric string, dan list record/array).
    """
    metrics: list[tuple[str, float]] = []

    def _collect(key_name: str, val: Any):
        if key_name == "ts":
            return
        if isinstance(val, bool):
            return
        if isinstance(val, (int, float)):
            metrics.append((key_name, float(val)))
            return
        if isinstance(val, str):
            try:
                num = float(val.strip())
                metrics.append((key_name, num))
            except (ValueError, TypeError):
                pass
            return
        if isinstance(val, dict):
            for k, v in val.items():
                child_key = f"{key_name}_{k}" if key_name else str(k)
                _collect(child_key, v)
            return
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    if "name" in item and ("value" in item or "val" in item):
                        name = str(item.get("name"))
                        v = item.get("value", item.get("val"))
                        _collect(name, v)
                    else:
                        for k, v in item.items():
                            _collect(str(k), v)

    if isinstance(payload, dict):
        for k, v in payload.items():
            _collect(str(k), v)
    elif isinstance(payload, list):
        _collect("", payload)

    return metrics
