from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.clickhouse_client import get_client
from app.config import settings
from app.database_pg import get_pg_db
from app.open_api_auth import verify_mitratel_api_key
from app.routers.sps_analytics import (
    _build_performance_payload,
    _fetch_site_telemetry_snapshot,
    _load_site_sps_config,
)
from app.sps_engine import evaluate_mppt_health, evaluate_pv_health

router = APIRouter(
    prefix="/api/v1/external",
    tags=["mitratel-open-api"],
    dependencies=[Depends(verify_mitratel_api_key)],
)


def _resolve_tenant_for_site(db: Session, site_slug: str, tenant_slug: str | None) -> str:
    """Mendapatkan tenant_slug efektif untuk site.
    Jika tidak dispesifikasikan oleh klien, dicari otomatis dari relasi site -> tenant di PostgreSQL.
    """
    if tenant_slug:
        return tenant_slug

    try:
        row = db.execute(
            text(
                "SELECT t.slug FROM sites s JOIN tenants t ON t.id = s.tenant_id "
                "WHERE s.slug = :s_slug LIMIT 1"
            ),
            {"s_slug": site_slug},
        ).first()
        if row and row[0]:
            return str(row[0])
    except Exception:
        pass

    return settings.mitratel_default_tenant_slug


@router.get(
    "/sites/{site_slug}/metrics",
    summary="Data Operasional Real-time & Kalkulasi Efisiensi SPS (On-Demand Pull)",
    description=(
        "Menyediakan data operasional real-time parameter kelistrikan DC (−48 VDC), "
        "Solar Contribution Ratio (SCR), Performance Ratio (PR), dan pembagian daya DC Busbar "
        "sesuai RKS Pasal 2.3.3.c butir 5."
    ),
)
def get_external_site_metrics(
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Slug tenant (opsional, auto-resolved)"),
    start: datetime | None = Query(default=None, description="Rentang awal observasi UTC (ISO8601)"),
    end: datetime | None = Query(default=None, description="Rentang akhir observasi UTC (ISO8601)"),
    db: Session = Depends(get_pg_db),
) -> dict[str, Any]:
    effective_tenant = _resolve_tenant_for_site(db, site_slug, tenant_slug)
    now = datetime.now(timezone.utc)
    end_dt = end or (now + timedelta(minutes=1))
    start_dt = start or (now - timedelta(hours=24))
    hours_window = max(1.0, (end_dt - start_dt).total_seconds() / 3600.0)

    site_cfg = _load_site_sps_config(db, effective_tenant, site_slug)
    latest, averages = _fetch_site_telemetry_snapshot(effective_tenant, site_slug, start_dt, end_dt)
    return _build_performance_payload(
        effective_tenant, site_slug, site_cfg, latest, averages, hours_window
    )


@router.get(
    "/sites/{site_slug}/health",
    summary="Indeks Kesehatan PV & MPPT Controller",
    description=(
        "Menampilkan skor kesehatan PV Array (PR vs iradiasi, string current balance) "
        "dan MPPT Solar Controller (efisiensi konversi >97%, temperatur <70°C, load sharing +0.5V s/d +1.0V) "
        "sesuai RKS Pasal 2.3.3.b."
    ),
)
def get_external_site_health(
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Slug tenant (opsional, auto-resolved)"),
    start: datetime | None = Query(default=None, description="Rentang awal observasi UTC (ISO8601)"),
    end: datetime | None = Query(default=None, description="Rentang akhir observasi UTC (ISO8601)"),
    db: Session = Depends(get_pg_db),
) -> dict[str, Any]:
    effective_tenant = _resolve_tenant_for_site(db, site_slug, tenant_slug)
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


@router.get(
    "/sites/{site_slug}/daily",
    summary="Riwayat Kalkulasi Harian Efisiensi Energi & Rekonsiliasi",
    description=(
        "Menampilkan riwayat agregasi harian energi surya, suplai rectifier grid, konsumsi beban, "
        "dan persentase kontribusi surya (SCR) dengan retensi minimal 24 bulan."
    ),
)
def get_external_site_daily_energy(
    site_slug: str,
    tenant_slug: str | None = Query(default=None, description="Slug tenant (opsional, auto-resolved)"),
    start_date: date | None = Query(default=None, description="Tanggal awal (YYYY-MM-DD)"),
    end_date: date | None = Query(default=None, description="Tanggal akhir (YYYY-MM-DD)"),
    limit: int = Query(default=30, ge=1, le=730, description="Jumlah hari maksimal"),
    db: Session = Depends(get_pg_db),
) -> dict[str, Any]:
    effective_tenant = _resolve_tenant_for_site(db, site_slug, tenant_slug)
    client = get_client()

    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    records: list[dict[str, Any]] = []
    try:
        sql = """
            SELECT
                date,
                solar_kwh,
                grid_kwh,
                load_kwh,
                solar_contribution_pct,
                performance_ratio_pct,
                updated_at
            FROM sps_daily_energy
            WHERE tenant_slug = {tenant_slug:String}
              AND site_slug = {site_slug:String}
              AND date >= {s_date:Date}
              AND date <= {e_date:Date}
            ORDER BY date DESC
            LIMIT {limit:UInt32}
        """
        res = client.query(
            sql,
            parameters={
                "tenant_slug": effective_tenant,
                "site_slug": site_slug,
                "s_date": s_date,
                "e_date": e_date,
                "limit": limit,
            },
        )
        for row in res.result_rows:
            records.append(
                {
                    "date": str(row[0]),
                    "solar_kwh": float(row[1]),
                    "grid_kwh": float(row[2]),
                    "load_kwh": float(row[3]),
                    "solar_contribution_pct": float(row[4]),
                    "performance_ratio_pct": float(row[5]),
                    "updated_at": row[6].isoformat() if hasattr(row[6], "isoformat") else str(row[6]),
                }
            )
    except Exception:
        # Fallback bila tabel belum memiliki baris atau test mock
        pass

    return {
        "tenant_slug": effective_tenant,
        "site_slug": site_slug,
        "records": records,
        "total": len(records),
    }
