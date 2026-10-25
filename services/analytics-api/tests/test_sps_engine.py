from datetime import datetime, timezone

from app.sps_engine import (
    calculate_performance_ratio,
    calculate_solar_contribution,
    detect_string_anomaly,
    evaluate_mppt_health,
    evaluate_pv_health,
)
from tests.conftest import make_token


def test_solar_contribution_ratio():
    solar_kwh = 35.0
    total_load_kwh = 70.0
    scr = calculate_solar_contribution(solar_kwh=solar_kwh, total_load_kwh=total_load_kwh)
    assert scr == 50.0  # 50% beban disuplai surya
    assert calculate_solar_contribution(solar_kwh=0.0, total_load_kwh=0.0) == 0.0
    assert calculate_solar_contribution(solar_kwh=80.0, total_load_kwh=70.0) == 100.0


def test_performance_ratio_calculation():
    # Kapasitas 5.85 kWp (Tipe A), iradiasi harian 5.0 kWh/m2 (PSH) -> teoretis 29.25 kWh
    # Produksi aktual 24.8625 kWh -> PR = 85.0%
    pr = calculate_performance_ratio(
        actual_solar_kwh=24.8625,
        irradiance_kwh_m2=5.0,
        pv_capacity_kwp=5.85,
    )
    assert pr == 85.0
    assert calculate_performance_ratio(actual_solar_kwh=10.0, irradiance_kwh_m2=0.0, pv_capacity_kwp=5.85) == 0.0


def test_string_anomaly_detection():
    # RKS 2.4.2 butir A2: Deviasi antar string > 5% dianggap anomali
    strings = [16.0, 16.2, 14.5]  # string 3 drop > 5%
    is_anomaly, max_dev = detect_string_anomaly(strings)
    assert is_anomaly is True
    assert max_dev > 5.0

    normal_strings = [16.0, 16.2, 15.9]
    is_anom_ok, max_dev_ok = detect_string_anomaly(normal_strings)
    assert is_anom_ok is False
    assert max_dev_ok <= 5.0


def test_pv_and_mppt_health_evaluation():
    pv_health = evaluate_pv_health(
        actual_solar_kwh=24.8625,
        irradiance_kwh_m2=5.0,
        pv_capacity_kwp=5.85,
        string_currents=[16.0, 16.1],
    )
    assert pv_health["status"] == "HEALTHY"
    assert pv_health["string_anomaly"] is False
    assert pv_health["health_index"] >= 80.0

    # MPPT normal: efisiensi > 97%, suhu < 70C, tegangan +0.7V di atas float rectifier
    mppt_ok = evaluate_mppt_health(
        p_pv=3000.0,
        p_mppt_out=2940.0,  # 98.0%
        temp_mppt=45.0,
        v_mppt_out=54.2,
        rectifier_float_voltage=53.5,
    )
    assert mppt_ok["efficiency_pct"] == 98.0
    assert mppt_ok["is_efficiency_ok"] is True
    assert mppt_ok["is_temperature_ok"] is True
    assert mppt_ok["load_sharing_active"] is True
    assert mppt_ok["status"] == "HEALTHY"

    # MPPT overheat (> 70C) & efisiensi turun (< 97%)
    mppt_bad = evaluate_mppt_health(
        p_pv=3000.0,
        p_mppt_out=2700.0,  # 90.0%
        temp_mppt=74.5,
        v_mppt_out=53.4,
        rectifier_float_voltage=53.5,
    )
    assert mppt_bad["is_efficiency_ok"] is False
    assert mppt_bad["is_temperature_ok"] is False
    assert mppt_bad["status"] == "CRITICAL"


async def test_sps_performance_and_health_endpoints(client, ch_client, tenant_a):
    now = datetime.now(timezone.utc)
    rows = [
        ("acme", "site-jkt-01", "mppt-01", "irradiance", 850.0, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "v_pv", 185.0, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "i_pv", 16.0, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "p_pv", 2960.0, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "v_mppt_out", 54.2, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "i_mppt_out", 53.5, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "p_mppt_out", 2899.7, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "v_busbar", 54.1, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "i_rectifier", 12.0, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "p_rectifier", 649.2, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "temp_mppt", 43.5, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "i_pv_string1", 8.1, now, ""),
        ("acme", "site-jkt-01", "mppt-01", "i_pv_string2", 8.0, now, ""),
    ]
    ch_client.insert(
        "telemetry",
        rows,
        column_names=["tenant_slug", "site_slug", "device_key", "metric_name", "metric_value", "ts", "raw_payload"],
    )

    token = make_token(tenant_a.id, "tenant_admin")
    headers = {"Authorization": f"Bearer {token}"}

    perf_res = await client.get("/api/sps/sites/site-jkt-01/performance", headers=headers)
    assert perf_res.status_code == 200, perf_res.text
    perf_data = perf_res.json()
    assert perf_data["site_slug"] == "site-jkt-01"
    assert perf_data["tenant_slug"] == "acme"
    assert perf_data["power_flow"]["p_mppt_out"] == 2899.7
    assert perf_data["power_flow"]["p_rectifier"] == 649.2
    assert perf_data["power_flow"]["v_mppt_out"] == 54.2
    assert perf_data["solar_contribution_pct"] > 0

    health_res = await client.get("/api/sps/sites/site-jkt-01/health", headers=headers)
    assert health_res.status_code == 200, health_res.text
    health_data = health_res.json()
    assert health_data["site_slug"] == "site-jkt-01"
    assert "pv_health" in health_data
    assert "mppt_health" in health_data
    assert health_data["mppt_health"]["is_efficiency_ok"] is True
    assert health_data["pv_health"]["string_anomaly"] is False
