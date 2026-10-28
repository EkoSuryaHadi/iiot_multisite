from datetime import datetime, timedelta, timezone

from app.alert_evaluator import (
    SLA_RULES,
    classify_severity,
    evaluate_site_sla_status,
)


def test_classify_critical_total_outage():
    # SPS mati total di siang bolong (irradiance > 500 tapi p_mppt == 0)
    sev, cat, msg = classify_severity(irradiance=600.0, p_mppt=0.0, is_offline=False)
    assert sev == "CRITICAL"
    assert cat == "TOTAL_OUTAGE"
    assert SLA_RULES[sev]["response_hours"] == 4
    assert SLA_RULES[sev]["restoration_hours"] == 24


def test_classify_critical_mppt_overheat():
    # MPPT temperatur kritis > 75°C
    sev, cat, msg = classify_severity(
        irradiance=600.0, p_mppt=2500.0, temp_mppt=78.0, is_offline=False
    )
    assert sev == "CRITICAL"
    assert cat == "OVERHEAT_CRITICAL"


def test_classify_major_production_drop():
    # Produksi drop > 30% dari potensi teoritis
    sev, cat, msg = classify_severity(
        irradiance=800.0, p_mppt=1500.0, theoretical_p=4000.0, is_offline=False
    )
    assert sev == "MAYOR"
    assert cat == "PRODUCTION_DROP_MAJOR"
    assert SLA_RULES[sev]["response_hours"] == 8
    assert SLA_RULES[sev]["restoration_hours"] == 72


def test_classify_major_string_deviation():
    # String deviation > 5%
    sev, cat, msg = classify_severity(
        irradiance=700.0,
        p_mppt=2800.0,
        string_deviation_pct=8.5,
        is_offline=False,
    )
    assert sev == "MAYOR"
    assert cat == "STRING_ANOMALY"


def test_classify_major_pms_offline():
    # PMS offline
    sev, cat, msg = classify_severity(
        irradiance=0.0, p_mppt=0.0, is_offline=True
    )
    assert sev == "MAYOR"
    assert cat == "PMS_OFFLINE"


def test_classify_minor_anomaly():
    # Produksi drop antara 15% - 30%
    sev, cat, msg = classify_severity(
        irradiance=800.0, p_mppt=3200.0, theoretical_p=4000.0, is_offline=False
    )
    assert sev == "MINOR"
    assert cat == "PRODUCTION_DROP_MINOR"
    assert SLA_RULES[sev]["response_hours"] == 24
    assert SLA_RULES[sev]["restoration_hours"] == 168


def test_classify_healthy_normal():
    # Normal operation
    sev, cat, msg = classify_severity(
        irradiance=800.0, p_mppt=3800.0, theoretical_p=4000.0, is_offline=False, temp_mppt=45.0
    )
    assert sev == "NONE"


def test_sla_status_countdown_and_breach():
    now = datetime.now(timezone.utc)
    # Incident dibuat 5 jam yang lalu tanpa di-acknowledge
    incident = {
        "created_at": now - timedelta(hours=5),
        "acknowledged_at": None,
        "resolved_at": None,
        "severity": "CRITICAL",  # SLA Response <= 4 jam
    }
    status = evaluate_site_sla_status(incident)
    assert status["is_response_breached"] is True
    assert status["response_time_hours"] >= 5.0
    assert status["is_restoration_breached"] is False
