from dataclasses import dataclass
from sqlalchemy import text

from app.cache import tenant_slug_cache
from app.database_pg import PgSessionLocal

# Konvensi topik standar: t/{tenant_slug}/s/{site_slug}/d/{device_id}/telemetry|status|cmd|resp
TELEMETRY_SUFFIX = "telemetry"
STATUS_SUFFIX = "status"
BUFFERED_SUFFIX = "buffered"


@dataclass
class ParsedDeviceTopic:
    tenant_slug: str
    site_slug: str
    device_key: str
    suffix: str


def _lookup_device_slugs(device_key: str) -> tuple[str, str] | None:
    def _query() -> tuple[str, str] | None:
        try:
            with PgSessionLocal() as db:
                row = db.execute(
                    text(
                        "SELECT t.slug, s.slug FROM devices d "
                        "JOIN tenants t ON t.id = d.tenant_id "
                        "JOIN sites s ON s.id = d.site_id "
                        "WHERE d.device_key = :dev_key LIMIT 1"
                    ),
                    {"dev_key": device_key},
                ).first()
                if row:
                    return (str(row[0]), str(row[1]))
                return None
        except Exception:
            return None

    return tenant_slug_cache.get_or_set(f"dev_slugs:{device_key}", _query)


def parse_device_topic(topic: str) -> ParsedDeviceTopic | None:
    parts = topic.split("/")

    # Format standar IIoT: t/{tenant}/s/{site}/d/{device}/{suffix}
    if len(parts) == 7 and parts[0] == "t" and parts[2] == "s" and parts[4] == "d":
        suffix = TELEMETRY_SUFFIX if parts[6] == BUFFERED_SUFFIX else parts[6]
        return ParsedDeviceTopic(
            tenant_slug=parts[1],
            site_slug=parts[3],
            device_key=parts[5],
            suffix=suffix,
        )

    # Format topik khusus SPS: sps/{tenant}/{site}/{device}[/{suffix}]
    if parts and parts[0] == "sps" and len(parts) in (4, 5):
        raw_suffix = parts[4] if len(parts) == 5 else TELEMETRY_SUFFIX
        suffix = TELEMETRY_SUFFIX if raw_suffix == BUFFERED_SUFFIX else raw_suffix
        return ParsedDeviceTopic(
            tenant_slug=parts[1],
            site_slug=parts[2],
            device_key=parts[3],
            suffix=suffix,
        )

    # Format Gateway Haiwell / IoT: data/{project}/{group}/{device_key}
    if parts and parts[0] == "data" and len(parts) >= 2:
        device_key = parts[-1]
        slugs = _lookup_device_slugs(device_key)
        if slugs:
            return ParsedDeviceTopic(
                tenant_slug=slugs[0],
                site_slug=slugs[1],
                device_key=device_key,
                suffix=TELEMETRY_SUFFIX,
            )

    return None
