from typing import Any

# Konstanta default RKS Teknis & ToR SPS On-Grid Mitratel
DEFAULT_PV_CAPACITY_KWP = 5.85  # Default Konfigurasi Tipe A (5.85 kWp / MPPT 80A)
DEFAULT_RECTIFIER_FLOAT_VOLTAGE = 53.5  # -48 VDC system float baseline (53.5 V)
DEFAULT_BASELINE_KWH_DAILY = 72.0  # Beban rata-rata 3.0 kW x 24 jam
DEFAULT_PLN_TARIFF_IDR = 1444.70  # Tarif PLN B3/I3 rata-rata per kWh (Rp)
DEFAULT_GRID_EMISSION_FACTOR = 0.85  # Faktor emisi grid (kg CO2e / kWh)
MPPT_MIN_EFFICIENCY_PCT = 97.0  # RKS Pasal 2.3.2: Efisiensi konversi MPPT >= 97%
MPPT_MAX_TEMP_C = 70.0  # RKS Pasal 2.3.2: Batas temperatur operasi MPPT < 70°C
STRING_DEVIATION_THRESHOLD_PCT = 5.0  # RKS Pasal 2.4.2 butir A2: Deviasi antar string > 5%


def calculate_solar_contribution(solar_kwh: float, total_load_kwh: float) -> float:
    """Menghitung Solar Contribution Ratio / SCR (%) sesuai RKS Pasal 2.3.3.a.
    Persentase kontribusi energi surya terhadap total konsumsi beban DC site.
    """
    if total_load_kwh <= 0.0 or solar_kwh <= 0.0:
        return 0.0
    scr = (solar_kwh / total_load_kwh) * 100.0
    return round(min(max(scr, 0.0), 100.0), 2)


def calculate_performance_ratio(
    actual_solar_kwh: float,
    irradiance_kwh_m2: float,
    pv_capacity_kwp: float,
) -> float:
    """Menghitung Performance Ratio / PR (%) sistem PV terhadap iradiasi matahari (PSH)
    dan kapasitas terpasang (kWp) pada kondisi standar (G_STC = 1 kW/m2).
    """
    if actual_solar_kwh <= 0.0 or irradiance_kwh_m2 <= 0.0 or pv_capacity_kwp <= 0.0:
        return 0.0
    theoretical_kwh = irradiance_kwh_m2 * pv_capacity_kwp
    if theoretical_kwh <= 0.0:
        return 0.0
    pr = (actual_solar_kwh / theoretical_kwh) * 100.0
    return round(min(max(pr, 0.0), 100.0), 2)


def detect_string_anomaly(
    string_currents: list[float],
    threshold_pct: float = STRING_DEVIATION_THRESHOLD_PCT,
) -> tuple[bool, float]:
    """Mendeteksi anomali arus antar string PV sesuai RKS Pasal 2.4.2 butir A2.
    Deviasi antar string > 5% terhadap string tertinggi diindikasikan sebagai anomali
    (shading, soiling, degradasi modul, atau konektor MC4 longgar).
    """
    active = [float(i) for i in string_currents if i is not None and float(i) >= 0.0]
    if len(active) < 2:
        return False, 0.0
    max_current = max(active)
    if max_current <= 0.1:
        # Malam hari atau arus terlalu kecil untuk dievaluasi
        return False, 0.0
    min_current = min(active)
    max_dev_pct = round(((max_current - min_current) / max_current) * 100.0, 2)
    return (max_dev_pct > threshold_pct), max_dev_pct


def evaluate_pv_health(
    actual_solar_kwh: float,
    irradiance_kwh_m2: float,
    pv_capacity_kwp: float,
    string_currents: list[float] | None = None,
) -> dict[str, Any]:
    """Mengevaluasi kesehatan PV Array (RKS Pasal 2.3.3.b):
    - Perbandingan iradiasi sensor vs produksi kWh aktual (PR)
    - Deteksi anomali arus antar string PV (> 5%)
    """
    pr_pct = calculate_performance_ratio(actual_solar_kwh, irradiance_kwh_m2, pv_capacity_kwp)
    is_string_anomaly, max_dev_pct = detect_string_anomaly(string_currents or [])

    # Nominal PR sehat pada sistem DC-coupled telekomunikasi adalah >= 75% (target 80-85%)
    if irradiance_kwh_m2 <= 0.05:
        base_health = 100.0
    else:
        base_health = min(100.0, round((pr_pct / 80.0) * 100.0, 2))

    if is_string_anomaly:
        penalty = min(35.0, max_dev_pct * 1.5)
        health_index = round(max(0.0, base_health - penalty), 2)
    else:
        health_index = base_health

    if health_index >= 80.0 and not is_string_anomaly:
        status = "HEALTHY"
    elif health_index >= 60.0:
        status = "WARNING"
    else:
        status = "DEGRADED"

    return {
        "health_index": health_index,
        "status": status,
        "performance_ratio_pct": pr_pct,
        "string_anomaly": is_string_anomaly,
        "max_string_deviation_pct": max_dev_pct,
        "string_currents": [round(float(x), 2) for x in (string_currents or [])],
    }


def evaluate_mppt_health(
    p_pv: float,
    p_mppt_out: float,
    temp_mppt: float,
    v_mppt_out: float | None = None,
    rectifier_float_voltage: float = DEFAULT_RECTIFIER_FLOAT_VOLTAGE,
) -> dict[str, Any]:
    """Mengevaluasi kesehatan MPPT Solar Charge Controller (RKS Pasal 2.1.1, 2.3.2 & 2.3.3.b):
    - Efisiensi konversi > 97%
    - Temperatur kerja < 70°C
    - Tegangan output DC berada +0.5V s/d +1.0V di atas rectifier float voltage untuk load sharing otomatis
    """
    if p_pv > 10.0:
        efficiency_pct = round(min(100.0, max(0.0, (p_mppt_out / p_pv) * 100.0)), 2)
        is_efficiency_ok = efficiency_pct >= MPPT_MIN_EFFICIENCY_PCT
    else:
        efficiency_pct = 100.0 if p_mppt_out <= 0 else 98.0
        is_efficiency_ok = True

    is_temperature_ok = temp_mppt < MPPT_MAX_TEMP_C

    voltage_delta = None
    load_sharing_active = False
    if v_mppt_out is not None and rectifier_float_voltage > 0:
        voltage_delta = round(v_mppt_out - rectifier_float_voltage, 2)
        # Prioritas suplai beban DC aktif bila tegangan MPPT >= float rectifier + 0.4V (toleransi praktis 0.4V - 1.5V)
        load_sharing_active = voltage_delta >= 0.4 and p_mppt_out > 0

    health_index = 100.0
    if not is_efficiency_ok:
        health_index -= max(10.0, (MPPT_MIN_EFFICIENCY_PCT - efficiency_pct) * 4.0)
    if not is_temperature_ok:
        health_index -= 40.0
    elif temp_mppt >= 60.0:
        health_index -= (temp_mppt - 60.0) * 2.0

    health_index = round(max(0.0, min(100.0, health_index)), 2)

    if not is_temperature_ok or health_index < 60.0:
        status = "CRITICAL"
    elif not is_efficiency_ok or temp_mppt >= 60.0 or health_index < 85.0:
        status = "WARNING"
    else:
        status = "HEALTHY"

    return {
        "health_index": health_index,
        "status": status,
        "efficiency_pct": efficiency_pct,
        "temp_mppt_c": round(float(temp_mppt), 2),
        "is_efficiency_ok": is_efficiency_ok,
        "is_temperature_ok": is_temperature_ok,
        "voltage_delta_v": voltage_delta,
        "load_sharing_active": load_sharing_active,
    }


def calculate_financial_and_esg_metrics(
    solar_kwh: float,
    tariff_idr_per_kwh: float = DEFAULT_PLN_TARIFF_IDR,
    grid_emission_factor_kg_per_kwh: float = DEFAULT_GRID_EMISSION_FACTOR,
) -> dict[str, float]:
    """Menghitung penghematan kWh PLN, estimasi biaya (Rp), dan reduksi emisi karbon (kg CO2e)."""
    clean_kwh = max(0.0, float(solar_kwh))
    return {
        "pln_kwh_saved": round(clean_kwh, 3),
        "cost_saved_idr": round(clean_kwh * tariff_idr_per_kwh, 2),
        "co2_avoided_kg": round(clean_kwh * grid_emission_factor_kg_per_kwh, 3),
    }
