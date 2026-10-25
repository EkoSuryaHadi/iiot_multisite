import json
from datetime import datetime, timezone
from typing import Any

# Kamus metrik standar SPS On-Grid Mitratel (RKS Pasal 2.3.3.a & 2.3.3.b)
SPS_STANDARD_METRICS: tuple[str, ...] = (
    "v_pv",
    "i_pv",
    "p_pv",
    "v_mppt_out",
    "i_mppt_out",
    "p_mppt_out",
    "v_busbar",
    "i_rectifier",
    "p_rectifier",
    "irradiance",
    "temp_mppt",
)

# Pemetaan alias metrik dari berbagai varian register Modbus RTU / Data Logger 4G ke nama standar SPS
SPS_METRIC_ALIASES: dict[str, str] = {
    "pv_voltage": "v_pv",
    "v_pv_in": "v_pv",
    "pv_current": "i_pv",
    "i_pv_in": "i_pv",
    "pv_power": "p_pv",
    "p_pv_in": "p_pv",
    "mppt_out_voltage": "v_mppt_out",
    "v_out_mppt": "v_mppt_out",
    "mppt_voltage": "v_mppt_out",
    "mppt_out_current": "i_mppt_out",
    "i_out_mppt": "i_mppt_out",
    "mppt_current": "i_mppt_out",
    "mppt_out_power": "p_mppt_out",
    "p_out_mppt": "p_mppt_out",
    "mppt_power": "p_mppt_out",
    "dc_bus_voltage": "v_busbar",
    "bus_voltage": "v_busbar",
    "v_dc_bus": "v_busbar",
    "rectifier_current": "i_rectifier",
    "i_rect": "i_rectifier",
    "rectifier_power": "p_rectifier",
    "p_rect": "p_rectifier",
    "solar_irradiance": "irradiance",
    "irr": "irradiance",
    "ghi": "irradiance",
    "mppt_temperature": "temp_mppt",
    "mppt_temp": "temp_mppt",
}

_TIMESTAMP_KEYS = {"ts", "timestamp", "time"}


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


def _parse_ts_value(ts_value: Any) -> datetime | None:
    if isinstance(ts_value, bool) or ts_value is None:
        return None
    if isinstance(ts_value, (int, float)):
        return _epoch_to_datetime(float(ts_value))
    if isinstance(ts_value, str):
        raw = ts_value.strip()
        if not raw:
            return None
        try:
            return _epoch_to_datetime(float(raw))
        except ValueError:
            pass
        try:
            iso_str = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
            dt = datetime.fromisoformat(iso_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def resolve_timestamp(payload: Any, publish_received_at: int | None) -> datetime:
    """Urutan prioritas: field `ts` / `timestamp` / `time` di payload (detik/milidetik epoch
    atau ISO-8601 untuk mendukung Store-and-Forward buffering hingga 7 hari) -> waktu
    diterima EMQX (`publish_received_at`, milidetik) -> waktu sekarang.
    """
    if isinstance(payload, dict):
        for key in ("ts", "timestamp", "time"):
            if key in payload:
                parsed = _parse_ts_value(payload.get(key))
                if parsed is not None:
                    return parsed

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
    numeric string, list record/array, serta normalisasi kamus metrik standar SPS).
    """
    metrics: list[tuple[str, float]] = []

    def _collect(key_name: str, val: Any):
        if key_name in _TIMESTAMP_KEYS:
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
            if k in ("records", "batch") and isinstance(v, list):
                continue
            _collect(str(k), v)
    elif isinstance(payload, list):
        _collect("", payload)

    existing_keys = {k for k, _ in metrics}
    metric_map = dict(metrics)

    # Tambahkan metrik standar SPS dari alias jika nama kanonik belum ada
    for raw_key, val in list(metrics):
        canonical = SPS_METRIC_ALIASES.get(raw_key.lower())
        if canonical and canonical not in existing_keys:
            metrics.append((canonical, val))
            existing_keys.add(canonical)
            metric_map[canonical] = val

    # Kalkulasi daya turunan (derived power) jika hanya tegangan & arus yang dikirim logger
    if "p_pv" not in existing_keys:
        if "v_pv" in metric_map and "i_pv" in metric_map:
            p_pv = round(metric_map["v_pv"] * metric_map["i_pv"], 2)
            metrics.append(("p_pv", p_pv))
            existing_keys.add("p_pv")
        else:
            # Jumlahkan daya dari string PV (v_pv_string1 * i_pv_string1, dst.)
            string_power = 0.0
            found_string = False
            for idx in range(1, 9):
                vk = f"v_pv_string{idx}"
                ik = f"i_pv_string{idx}"
                if vk in metric_map and ik in metric_map:
                    string_power += metric_map[vk] * metric_map[ik]
                    found_string = True
            if found_string:
                metrics.append(("p_pv", round(string_power, 2)))
                existing_keys.add("p_pv")

    if "p_mppt_out" not in existing_keys and "v_mppt_out" in metric_map and "i_mppt_out" in metric_map:
        p_mppt = round(metric_map["v_mppt_out"] * metric_map["i_mppt_out"], 2)
        metrics.append(("p_mppt_out", p_mppt))
        existing_keys.add("p_mppt_out")

    if "p_rectifier" not in existing_keys and "v_busbar" in metric_map and "i_rectifier" in metric_map:
        p_rect = round(metric_map["v_busbar"] * metric_map["i_rectifier"], 2)
        metrics.append(("p_rectifier", p_rect))
        existing_keys.add("p_rectifier")

    return metrics


def extract_buffered_records(
    payload: Any, publish_received_at: int | None
) -> list[tuple[datetime, list[tuple[str, float]], str]]:
    """Mengekstrak satu atau banyak record telemetri (mendukung Store-and-Forward buffering
    di mana logger mengirimkan array `records` atau `batch` berisi data historis saat
    kembali online).
    """
    if isinstance(payload, dict):
        batch_items = payload.get("records") or payload.get("batch")
        if isinstance(batch_items, list) and batch_items and all(isinstance(x, dict) for x in batch_items):
            results: list[tuple[datetime, list[tuple[str, float]], str]] = []
            for item in batch_items:
                ts = resolve_timestamp(item, publish_received_at)
                metrics = extract_numeric_metrics(item)
                raw = json.dumps(item, separators=(",", ":"))
                results.append((ts, metrics, raw))
            return results

    ts = resolve_timestamp(payload, publish_received_at)
    metrics = extract_numeric_metrics(payload)
    raw = json.dumps(payload, separators=(",", ":"))
    return [(ts, metrics, raw)]
