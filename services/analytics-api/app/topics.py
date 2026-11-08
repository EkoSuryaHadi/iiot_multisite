from dataclasses import dataclass
import re
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


def _normalize_suffix(raw: str) -> str:
    return TELEMETRY_SUFFIX if raw == BUFFERED_SUFFIX else raw


def parse_device_topic(topic: str) -> ParsedDeviceTopic | None:
    # Buang garis miring di awal/akhir: firmware vendor sering menulis "/tenant/site/device".
    normalized = topic.strip("/")
    parts = normalized.split("/") if normalized else []

    # Format standar IIoT: t/{tenant}/s/{site}/d/{device}/{suffix}
    if len(parts) == 7 and parts[0] == "t" and parts[2] == "s" and parts[4] == "d":
        return ParsedDeviceTopic(
            tenant_slug=parts[1],
            site_slug=parts[3],
            device_key=parts[5],
            suffix=_normalize_suffix(parts[6]),
        )

    # Format topik khusus SPS: sps/{tenant}/{site}/{device}[/{suffix}]
    if parts and parts[0] == "sps" and len(parts) in (4, 5):
        raw_suffix = parts[4] if len(parts) == 5 else TELEMETRY_SUFFIX
        return ParsedDeviceTopic(
            tenant_slug=parts[1],
            site_slug=parts[2],
            device_key=parts[3],
            suffix=_normalize_suffix(raw_suffix),
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

    # Format longgar: t/{tenant}/s/{site}/{device}[/{suffix}] — penanda "d" hilang
    if len(parts) >= 5 and parts[0] == "t" and parts[2] == "s":
        rest = parts[4:]
        if rest and rest[0] == "d":
            rest = rest[1:]
        if len(rest) == 1:
            return ParsedDeviceTopic(parts[1], parts[3], rest[0], TELEMETRY_SUFFIX)
        if len(rest) == 2:
            return ParsedDeviceTopic(parts[1], parts[3], rest[0], _normalize_suffix(rest[1]))

    # Format tanpa penanda: {tenant}/{site}/{device}[/{suffix}] — wajib cocok dengan DB
    if len(parts) in (3, 4) and parts[0] not in {"t", "sps", "data", "$SYS"}:
        device_key = parts[2]
        slugs = _lookup_device_slugs(device_key)
        if slugs and (slugs[0], slugs[1]) == (parts[0], parts[1]):
            raw_suffix = parts[3] if len(parts) == 4 else TELEMETRY_SUFFIX
            return ParsedDeviceTopic(parts[0], parts[1], device_key, _normalize_suffix(raw_suffix))

    return None


def _device_key_from_clientid(clientid: str) -> str | None:
    """Client id device berbentuk `{tenant}-{site}-{device_key}` (mis. solar-jkt-GNIS_MockupUSR)."""
    clean = clientid.split("/")[0].strip()
    if not clean:
        return None
    if clean.count("-") >= 2:
        return clean.split("-", 2)[-1]
    return clean


def parse_device_topic_with_client(topic: str, clientid: str | None = None) -> ParsedDeviceTopic | None:
    """parse_device_topic + cadangan untuk topik legacy vendor (UpTopic_*, SubTop*) yang
    identitas device-nya hanya bisa diambil dari client id koneksi."""
    parsed = parse_device_topic(topic)
    if parsed is not None or not clientid:
        return parsed
    device_key = _device_key_from_clientid(clientid)
    if not device_key:
        return None
    slugs = _lookup_device_slugs(device_key)
    if not slugs:
        return None

    segments = [p for p in topic.strip().split("/") if p]
    head = segments[0].lower() if segments else ""
    is_up = head.startswith("uptopic") or head.startswith("up_topic")
    is_sub = head.startswith("subtop") or head.startswith("sub_topic")
    # Topik yang isinya cuma NAMA device sendiri, mis. `/GNISAlphaProject`.
    is_own_name = len(segments) <= 2 and _norm(segments[-1]) == _norm(device_key) if segments else False

    if not (is_up or is_sub or is_own_name):
        return None

    return ParsedDeviceTopic(
        tenant_slug=slugs[0],
        site_slug=slugs[1],
        device_key=device_key,
        suffix="cmd" if is_sub else TELEMETRY_SUFFIX,
    )


def _norm(text: str) -> str:
    """Normalisasi nama: huruf kecil, hanya alfanumerik (abaikan _ dan -)."""
    return re.sub(r"[^a-z0-9]", "", text.lower())
