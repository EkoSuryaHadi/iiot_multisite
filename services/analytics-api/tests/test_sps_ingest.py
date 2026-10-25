from datetime import datetime, timedelta, timezone

from app.ingest_logic import (
    SPS_STANDARD_METRICS,
    extract_buffered_records,
    extract_numeric_metrics,
    resolve_timestamp,
)
from app.topics import TELEMETRY_SUFFIX, parse_device_topic


def test_sps_payload_metric_extraction():
    payload = {
        "ts": 1774435200,
        "irradiance": 850.5,
        "v_pv_string1": 185.4,
        "i_pv_string1": 16.2,
        "v_mppt_out": 54.2,
        "i_mppt_out": 52.8,
        "p_mppt_out": 2861.76,
        "temp_mppt": 42.5,
        "v_busbar": 53.6,
        "i_rectifier": 12.1,
    }
    metrics = dict(extract_numeric_metrics(payload))
    assert metrics["irradiance"] == 850.5
    assert metrics["v_mppt_out"] == 54.2
    assert metrics["temp_mppt"] == 42.5
    # Derived power metrics automatically computed when voltage & current exist
    assert metrics["p_pv"] == round(185.4 * 16.2, 2)
    assert metrics["p_rectifier"] == round(53.6 * 12.1, 2)
    assert "v_pv" in SPS_STANDARD_METRICS
    assert "p_mppt_out" in SPS_STANDARD_METRICS


def test_sps_metric_alias_standardization():
    payload = {
        "timestamp": 1774435200,
        "solar_irradiance": 910.0,
        "pv_voltage": 190.0,
        "pv_current": 15.0,
        "mppt_out_voltage": 54.0,
        "mppt_out_current": 50.0,
        "dc_bus_voltage": 53.5,
        "rectifier_current": 10.0,
        "mppt_temperature": 44.2,
    }
    metrics = dict(extract_numeric_metrics(payload))
    assert "timestamp" not in metrics
    assert metrics["irradiance"] == 910.0
    assert metrics["v_pv"] == 190.0
    assert metrics["i_pv"] == 15.0
    assert metrics["p_pv"] == 2850.0
    assert metrics["v_mppt_out"] == 54.0
    assert metrics["i_mppt_out"] == 50.0
    assert metrics["p_mppt_out"] == 2700.0
    assert metrics["v_busbar"] == 53.5
    assert metrics["i_rectifier"] == 10.0
    assert metrics["p_rectifier"] == 535.0
    assert metrics["temp_mppt"] == 44.2


def test_store_and_forward_timestamp_preservation():
    # Simulasi data buffering 3 hari lalu (epoch detik)
    past_time = datetime.now(timezone.utc) - timedelta(days=3)
    epoch_past = int(past_time.timestamp())
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    resolved = resolve_timestamp({"ts": epoch_past}, publish_received_at=now_ms)
    assert abs((resolved - past_time).total_seconds()) < 2

    # Simulasi data buffering 6 hari lalu dalam format ISO-8601 string pada field 'timestamp'
    past_6d = datetime.now(timezone.utc) - timedelta(days=6)
    iso_past = past_6d.isoformat()
    resolved_iso = resolve_timestamp({"timestamp": iso_past}, publish_received_at=now_ms)
    assert abs((resolved_iso - past_6d).total_seconds()) < 2


def test_store_and_forward_batch_records_extraction():
    t1 = int((datetime.now(timezone.utc) - timedelta(days=2)).timestamp())
    t2 = int((datetime.now(timezone.utc) - timedelta(days=1)).timestamp())
    payload = {
        "records": [
            {"ts": t1, "v_mppt_out": 54.1, "i_mppt_out": 40.0},
            {"ts": t2, "v_mppt_out": 54.3, "i_mppt_out": 45.0},
        ]
    }
    records = extract_buffered_records(payload, publish_received_at=None)
    assert len(records) == 2
    ts1, metrics1, _ = records[0]
    ts2, metrics2, _ = records[1]
    assert int(ts1.timestamp()) == t1
    assert dict(metrics1)["v_mppt_out"] == 54.1
    assert dict(metrics1)["p_mppt_out"] == round(54.1 * 40.0, 2)
    assert int(ts2.timestamp()) == t2
    assert dict(metrics2)["v_mppt_out"] == 54.3


def test_sps_topic_parsing():
    # Standard topic remains compatible
    t_std = parse_device_topic("t/mitratel/s/site-jkt-01/d/mppt-01/telemetry")
    assert t_std is not None
    assert t_std.tenant_slug == "mitratel"
    assert t_std.site_slug == "site-jkt-01"
    assert t_std.device_key == "mppt-01"
    assert t_std.suffix == TELEMETRY_SUFFIX

    # SPS shorthand topic: sps/{tenant}/{site}/{device}/telemetry
    t_sps = parse_device_topic("sps/mitratel/site-jkt-01/logger-01/telemetry")
    assert t_sps is not None
    assert t_sps.tenant_slug == "mitratel"
    assert t_sps.site_slug == "site-jkt-01"
    assert t_sps.device_key == "logger-01"
    assert t_sps.suffix == TELEMETRY_SUFFIX
