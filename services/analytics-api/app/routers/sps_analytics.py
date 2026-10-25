from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.clickhouse_client import get_client
from app.database_pg import get_pg_db
from app.deps import CurrentUser, get_current_user, resolve_tenant_scope
from app.sps_engine import (
    DEFAULT_BASELINE_KWH_DAILY,
    DEFAULT_PV_CAPACITY_KWP,
    DEFAULT_RECTIFIER_FLOAT_VOLTAGE,
    calculate_financial_and_esg_metrics,
    calculate_performance_ratio,
    calculate_solar_contribution,
    evaluate_mppt_health,
    evaluate_pv_health,
)

router = APIRouter(tags=["sps-analytics"])

_LATEST_METRICS_SQL = """
    SELECT metric_name, argMax(metric_value, ts) AS latest_val, avg(metric_value) AS avg_val
    FROM telemetry
    WHERE tenant_slug = {tenant_slug:String}
      AND site_slug = {site_slug:String}
      AND ts >= {start:DateTime64(3)}
      AND ts <= {end:DateTime64(3)}
    GROUP BY metric_name
"""


def _load_site_sps_config(db: Session, tenant_slug: str, site_slug: str) -> dict[str, Any]:
    config = {
        "site_type": "TYPE_A",
        "pv_capacity_kwp": DEFAULT_PV_CAPACITY_KWP,
        "mppt_capacity_a": 80.0,
        "rectifier_float_voltage": DEFAULT_RECTIFIER_FLOAT_VOLTAGE,
        "baseline_kwh_daily": DEFAULT_BASELINE_KWH_DAILY,
    }
    try:
        row = db.execute(
            text(
                "SELECT s.site_type, s.pv_capacity_kwp, s.mppt_capacity_a, "
                "s.rectifier_float_voltage, s.baseline_kwh_daily "
                "FROM sites s JOIN tenants t ON t.id = s.tenant_id "
                "WHERE t.slug = :t_slug AND s.slug = :s_slug LIMIT 1"
            ),
            {"t_slug": tenant_slug, "s_slug": site_slug},
        ).first()
        if row:
            if row[0] is not None:
                config["site_type"] = str(row[0])
            if row[1] is not None:
                config["pv_capacity_kwp"] = float(row[1])
            if row[2] is not None:
                config["mppt_capacity_a"] = float(row[2])
            if row[3] is not None:
                config["rectifier_float_voltage"] = float(row[3])
            if row[4] is not None:
                config["baseline_kwh_daily"] = float(row[4])
    except Exception:
        pass
    return config


def _fetch_site_telemetry_snapshot(
    tenant_slug: str, site_slug: str, start: datetime, end: datetime
) -> tuple[dict[str, float], dict[str, float]]:
    client = get_client()
    res = client.query(
        _LATEST_METRICS_SQL,
        parameters={
            "tenant_slug": tenant_slug,
            "site_slug": site_slug,
            "start": start,
            "end": end,
        },
    )
    latest: dict[str, float] = {}
    averages: dict[str, float] = {}
    for row in res.result_rows:
        m_name = str(row[0])
        latest[m_name] = float(row[1])
        averages[m_name] = float(row[2])
    return latest, averages


def _build_performance_payload(
    tenant_slug: str,
    site_slug: str,
    site_cfg: dict[str, Any],
    latest: dict[str, float],
    averages: dict[str, float],
    hours_window: float,
) -> dict[str, Any]:
    v_pv = latest.get("v_pv", latest.get("v_pv_string1", 0.0))
    i_pv = latest.get("i_pv", latest.get("i_pv_string1", 0.0))
    p_pv = latest.get("p_pv", round(v_pv * i_pv, 2))
    v_mppt_out = latest.get("v_mppt_out", 0.0)
    i_mppt_out = latest.get("i_mppt_out", 0.0)
    p_mppt_out = latest.get("p_mppt_out", round(v_mppt_out * i_mppt_out, 2))
    v_busbar = latest.get("v_busbar", v_mppt_out or site_cfg["rectifier_float_voltage"])
    i_rectifier = latest.get("i_rectifier", 0.0)
    p_rectifier = latest.get("p_rectifier", round(v_busbar * i_rectifier, 2))
    p_load = latest.get("p_load", round(p_mppt_out + p_rectifier, 2))
    irradiance = latest.get("irradiance", 0.0)
    temp_mppt = latest.get("temp_mppt", 0.0)

    eff_hours = max(1.0, min(hours_window, 24.0))
    avg_p_mppt = averages.get("p_mppt_out", p_mppt_out)
    avg_p_rect = averages.get("p_rectifier", p_rectifier)
    avg_irr = averages.get("irradiance", irradiance)

    solar_kwh = latest.get("solar_kwh", round((avg_p_mppt / 1000.0) * eff_hours, 3))
    grid_kwh = latest.get("grid_kwh", round((avg_p_rect / 1000.0) * eff_hours, 3))
    load_kwh = latest.get("load_kwh", round(solar_kwh + grid_kwh, 3))
    irradiance_kwh_m2 = round((avg_irr / 1000.0) * eff_hours, 3)

    scr_pct = calculate_solar_contribution(solar_kwh=solar_kwh, total_load_kwh=load_kwh)
    pr_pct = calculate_performance_ratio(
        actual_solar_kwh=solar_kwh,
        irradiance_kwh_m2=irradiance_kwh_m2,
        pv_capacity_kwp=site_cfg["pv_capacity_kwp"],
    )
    fin_esg = calculate_financial_and_esg_metrics(solar_kwh=solar_kwh)

    voltage_delta = round(v_mppt_out - site_cfg["rectifier_float_voltage"], 2) if v_mppt_out > 0 else 0.0
    load_sharing_active = voltage_delta >= 0.4 and p_mppt_out > 0

    return {
        "tenant_slug": tenant_slug,
        "site_slug": site_slug,
        "site_config": site_cfg,
        "solar_kwh": solar_kwh,
        "grid_kwh": grid_kwh,
        "load_kwh": load_kwh,
        "solar_contribution_pct": scr_pct,
        "performance_ratio_pct": pr_pct,
        **fin_esg,
        "power_flow": {
            "irradiance": round(irradiance, 2),
            "v_pv": round(v_pv, 2),
            "i_pv": round(i_pv, 2),
            "p_pv": round(p_pv, 2),
            "v_mppt_out": round(v_mppt_out, 2),
            "i_mppt_out": round(i_mppt_out, 2),
            "p_mppt_out": round(p_mppt_out, 2),
            "v_busbar": round(v_busbar, 2),
            "i_rectifier": round(i_rectifier, 2),
            "p_rectifier": round(p_rectifier, 2),
            "p_load": round(p_load, 2),
            "temp_mppt": round(temp_mppt, 2),
            "rectifier_float_voltage": site_cfg["rectifier_float_voltage"],
            "voltage_delta_v": voltage_delta,
            "load_sharing_active": load_sharing_active,
        },
    }


@router.get("/api/sps/sites/{site_slug}/performance")
@router.get("/sps/sites/{site_slug}/performance")
def get_site_sps_performance(
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    start: datetime | None = None,
    end: datetime | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_pg_db),
) -> dict[str, Any]:
    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    now = datetime.now(timezone.utc)
    end_dt = end or (now + timedelta(minutes=1))
    start_dt = start or (now - timedelta(hours=24))
    hours_window = max(1.0, (end_dt - start_dt).total_seconds() / 3600.0)

    site_cfg = _load_site_sps_config(db, effective_tenant, site_slug)
    latest, averages = _fetch_site_telemetry_snapshot(effective_tenant, site_slug, start_dt, end_dt)
    return _build_performance_payload(effective_tenant, site_slug, site_cfg, latest, averages, hours_window)


@router.get("/api/sps/sites/{site_slug}/health")
@router.get("/sps/sites/{site_slug}/health")
def get_site_sps_health(
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Hanya berlaku untuk superadmin"),
    start: datetime | None = None,
    end: datetime | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_pg_db),
) -> dict[str, Any]:
    effective_tenant = resolve_tenant_scope(current_user, tenant_slug)
    now = datetime.now(timezone.utc)
    end_dt = end or (now + timedelta(minutes=1))
    start_dt = start or (now - timedelta(hours=24))

    site_cfg = _load_site_sps_config(db, effective_tenant, site_slug)
    latest, averages = _fetch_site_telemetry_snapshot(effective_tenant, site_slug, start_dt, end_dt)

    v_pv = latest.get("v_pv", latest.get("v_pv_string1", 0.0))
    i_pv = latest.get("i_pv", latest.get("i_pv_string1", 0.0))
    p_pv = latest.get("p_pv", round(v_pv * i_pv, 2))
    v_mppt_out = latest.get("v_mppt_out", 0.0)
    i_mppt_out = latest.get("i_mppt_out", 0.0)
    p_mppt_out = latest.get("p_mppt_out", round(v_mppt_out * i_mppt_out, 2))
    temp_mppt = latest.get("temp_mppt", 25.0)
    avg_irr = averages.get("irradiance", latest.get("irradiance", 0.0))
    avg_p_mppt = averages.get("p_mppt_out", p_mppt_out)

    string_currents: list[float] = []
    for idx in range(1, 9):
        key = f"i_pv_string{idx}"
        if key in latest:
            string_currents.append(latest[key])

    solar_kwh = latest.get("solar_kwh", round(avg_p_mppt / 1000.0, 3))
    irradiance_kwh_m2 = round(avg_irr / 1000.0, 3)

    pv_health = evaluate_pv_health(
        actual_solar_kwh=solar_kwh,
        irradiance_kwh_m2=irradiance_kwh_m2,
        pv_capacity_kwp=site_cfg["pv_capacity_kwp"],
        string_currents=string_currents,
    )
    mppt_health = evaluate_mppt_health(
        p_pv=p_pv,
        p_mppt_out=p_mppt_out,
        temp_mppt=temp_mppt,
        v_mppt_out=v_mppt_out if v_mppt_out > 0 else None,
        rectifier_float_voltage=site_cfg["rectifier_float_voltage"],
    )

    overall_index = round((pv_health["health_index"] + mppt_health["health_index"]) / 2.0, 2)
    if mppt_health["status"] == "CRITICAL" or pv_health["status"] == "DEGRADED":
        overall_status = "CRITICAL" if mppt_health["status"] == "CRITICAL" else "DEGRADED"
    elif mppt_health["status"] == "WARNING" or pv_health["status"] == "WARNING":
        overall_status = "WARNING"
    else:
        overall_status = "HEALTHY"

    return {
        "tenant_slug": effective_tenant,
        "site_slug": site_slug,
        "site_health_index": overall_index,
        "status": overall_status,
        "pv_health": pv_health,
        "mppt_health": mppt_health,
    }
