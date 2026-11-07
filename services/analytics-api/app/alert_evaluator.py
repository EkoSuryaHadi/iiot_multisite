import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Aturan SLA RKS Teknis & ToR SPS On-Grid Mitratel (Pasal 2.6 & 2.5.4)
SLA_RULES: dict[str, dict[str, int]] = {
    "CRITICAL": {
        "response_hours": 4,       # Response Time <= 4 jam
        "restoration_hours": 24,   # Restoration Time <= 24 jam (1x24 jam)
    },
    "MAYOR": {
        "response_hours": 8,       # Response Time <= 8 jam
        "restoration_hours": 72,   # Restoration Time <= 72 jam (3x24 jam)
    },
    "MINOR": {
        "response_hours": 24,      # Response Time <= 24 jam
        "restoration_hours": 168,  # Restoration Time <= 168 jam (7x24 jam)
    },
}


def classify_severity(
    irradiance: float,
    p_mppt: float,
    theoretical_p: float | None = None,
    is_offline: bool = False,
    temp_mppt: float | None = None,
    string_deviation_pct: float | None = None,
) -> tuple[str, str, str]:
    """Mengklasifikasikan tingkat keparahan alarm/insiden berdasarkan parameter operasional (RKS 2.5.4).

    Returns:
        (severity, category, message)
    """
    # 1. Critical: Temperatur kerja MPPT kritis (> 75°C)
    if temp_mppt is not None and temp_mppt >= 75.0:
        return (
            "CRITICAL",
            "OVERHEAT_CRITICAL",
            f"Temperatur kerja MPPT sangat tinggi ({temp_mppt:.1f}°C >= 75°C)",
        )

    # 2. Critical: SPS mati total di siang hari (iradiasi > 500 W/m² namun daya MPPT == 0)
    if irradiance > 500.0 and p_mppt <= 0.0:
        return (
            "CRITICAL",
            "TOTAL_OUTAGE",
            f"SPS mati total saat iradiasi tinggi ({irradiance:.1f} W/m², daya 0 W)",
        )

    # 3. Mayor: Data logger / PMS offline
    if is_offline:
        return (
            "MAYOR",
            "PMS_OFFLINE",
            "Koneksi monitoring data logger / PMS terputus ke platform",
        )

    # 4. Mayor: Deviasi antar string PV > 5% (RKS 2.4.2 butir A2)
    if string_deviation_pct is not None and string_deviation_pct > 5.0:
        return (
            "MAYOR",
            "STRING_ANOMALY",
            f"Ketidakseimbangan arus antar string PV terdeteksi ({string_deviation_pct:.1f}% > 5%)",
        )

    # 5. Mayor / Minor: Penurunan daya terhadap potensi teoritis
    if theoretical_p is not None and theoretical_p > 100.0:
        drop_pct = max(0.0, ((theoretical_p - p_mppt) / theoretical_p) * 100.0)
        if drop_pct > 30.0:
            return (
                "MAYOR",
                "PRODUCTION_DROP_MAJOR",
                f"Penurunan produksi daya surya {drop_pct:.1f}% (> 30%) dari potensi teoritis",
            )
        elif drop_pct >= 10.0:
            return (
                "MINOR",
                "PRODUCTION_DROP_MINOR",
                f"Penurunan ringan produksi daya surya {drop_pct:.1f}% (10%-30%)",
            )

    # 6. Minor: Suhu kerja MPPT meningkat (60°C - 75°C)
    if temp_mppt is not None and temp_mppt >= 60.0:
        return (
            "MINOR",
            "TEMPERATURE_WARNING",
            f"Temperatur MPPT mendekati batas kerja aman ({temp_mppt:.1f}°C)",
        )

    return ("NONE", "", "")


def evaluate_site_sla_status(incident: dict[str, Any]) -> dict[str, Any]:
    """Mengevaluasi countdown dan kepatuhan SLA untuk tiket insiden."""
    now = datetime.now(timezone.utc)
    created_at: datetime = incident["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    severity = incident.get("severity", "MINOR")
    sla_config = SLA_RULES.get(severity, SLA_RULES["MINOR"])

    ack_at: datetime | None = incident.get("acknowledged_at")
    if ack_at and ack_at.tzinfo is None:
        ack_at = ack_at.replace(tzinfo=timezone.utc)

    resolved_at: datetime | None = incident.get("resolved_at")
    if resolved_at and resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)

    # Hitung Response Time
    if ack_at:
        resp_duration_hours = max(0.0, (ack_at - created_at).total_seconds() / 3600.0)
        is_resp_breached = resp_duration_hours > sla_config["response_hours"]
    else:
        resp_duration_hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
        is_resp_breached = resp_duration_hours > sla_config["response_hours"]

    # Hitung Restoration Time
    if resolved_at:
        rest_duration_hours = max(0.0, (resolved_at - created_at).total_seconds() / 3600.0)
        is_rest_breached = rest_duration_hours > sla_config["restoration_hours"]
    else:
        rest_duration_hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
        is_rest_breached = rest_duration_hours > sla_config["restoration_hours"]

    resp_remaining_hours = max(0.0, sla_config["response_hours"] - resp_duration_hours)
    rest_remaining_hours = max(0.0, sla_config["restoration_hours"] - rest_duration_hours)

    return {
        "severity": severity,
        "sla_target_response_hours": sla_config["response_hours"],
        "sla_target_restoration_hours": sla_config["restoration_hours"],
        "response_time_hours": round(resp_duration_hours, 2),
        "restoration_time_hours": round(rest_duration_hours, 2),
        "response_remaining_hours": round(resp_remaining_hours, 2),
        "restoration_remaining_hours": round(rest_remaining_hours, 2),
        "is_response_breached": is_resp_breached,
        "is_restoration_breached": is_rest_breached,
    }

