from dataclasses import dataclass
import re

# Konvensi topik: t/{tenant_slug}/s/{site_slug}/d/{device_id}/telemetry|status|cmd|resp
DEVICE_PUBLISHABLE_SUFFIXES = {"telemetry", "status", "resp"}
DEVICE_SUBSCRIBABLE_SUFFIXES = {"cmd"}
DASHBOARD_SUBSCRIBABLE_SUFFIXES = {"telemetry", "status", "resp"}
DASHBOARD_PUBLISHABLE_SUFFIXES = {"cmd"}

# Prefix topik yang punya arti khusus / ditangani jalur lain — jangan ditafsirkan longgar.
_RESERVED_PREFIXES = {"data", "sps", "$SYS", "$share"}
_WILDCARDS = {"#", "+"}


@dataclass
class ParsedDeviceTopic:
    tenant_slug: str
    site_slug: str
    device_key: str
    suffix: str


def parse_device_topic(topic: str) -> ParsedDeviceTopic | None:
    parts = topic.split("/")
    if len(parts) != 7:
        return None
    t, tenant_slug, s, site_slug, d, device_key, suffix = parts
    if t != "t" or s != "s" or d != "d":
        return None
    return ParsedDeviceTopic(tenant_slug=tenant_slug, site_slug=site_slug, device_key=device_key, suffix=suffix)


def parse_device_topic_lenient(
    topic: str,
    device_key_hint: str | None = None,
    tenant_hint: str | None = None,
    site_hint: str | None = None,
) -> ParsedDeviceTopic | None:
    """Tafsirkan topik device yang tidak mengikuti konvensi ketat `t/{t}/s/{s}/d/{dev}/{suffix}`.

    Dipakai supaya device baru (firmware vendor, gateway lama, uji MQTT Explorer) tidak
    langsung ditolak. Keamanan tetap dijaga: tenant/site/device hasil tafsiran dicocokkan
    dengan identitas pemilik koneksi di `acl.decide()`, jadi device A tidak bisa memakai
    topik device B.

    Bentuk yang diterima:
      - `t/{tenant}/s/{site}/{dev}/{suffix}`      (penanda `d` hilang)
      - `t/{tenant}/s/{site}/d/{dev}`             (hanya sampai device, dianggap subscribe `cmd`)
      - `{tenant}/{site}/{dev}[/{suffix}]`        (tanpa penanda sama sekali, mis. /solar/jkt/DEV)
      - `UpTopic_*` / `Up_Topic_*`                (publish -> telemetry)
      - `SubTop*` / `Sub_Topic_*`                 (subscribe -> cmd)
      - ekor wildcard `/#` atau `/+` dibuang lebih dulu
    """
    parts = [p for p in topic.strip().split("/") if p]
    if not parts or parts[0] in _RESERVED_PREFIXES:
        return None

    while parts and parts[-1] in _WILDCARDS:
        parts.pop()
    if not parts:
        return None

    # Bentuk berawalan "t" (boleh salah jumlah segmen)
    if parts[0] == "t" and len(parts) >= 4 and parts[2] == "s":
        tenant_slug, site_slug = parts[1], parts[3]
        rest = parts[4:]
        if rest and rest[0] == "d":
            rest = rest[1:]
        if len(rest) == 1:
            return ParsedDeviceTopic(tenant_slug, site_slug, rest[0], "cmd")
        if len(rest) == 2:
            return ParsedDeviceTopic(tenant_slug, site_slug, rest[0], rest[1])
        return None

    # Bentuk tanpa penanda: {tenant}/{site}/{device}[/{suffix}]
    if len(parts) in (3, 4):
        suffix = parts[3] if len(parts) == 4 else "telemetry"
        return ParsedDeviceTopic(parts[0], parts[1], parts[2], suffix)

    # Nama topik legacy dari firmware vendor — device diambil dari identitas koneksi.
    if device_key_hint:
        head = parts[0].lower()
        if head.startswith("uptopic") or head.startswith("up_topic"):
            return ParsedDeviceTopic(tenant_hint, site_hint, device_key_hint, "telemetry")
        if head.startswith("subtop") or head.startswith("sub_topic"):
            return ParsedDeviceTopic(tenant_hint, site_hint, device_key_hint, "cmd")

        # Topik yang isinya cuma NAMA device sendiri, mis. `/GNISAlphaProject`
        # (device baru sering publish ke nama project-nya, bukan ke struktur t/s/d).
        if len(parts) <= 2 and _norm(parts[-1]) == _norm(device_key_hint):
            return ParsedDeviceTopic(tenant_hint, site_hint, device_key_hint, "telemetry")

    return None


def _norm(text: str) -> str:
    """Normalisasi nama: huruf kecil, hanya alfanumerik (abaikan _ dan -)."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def device_topic_prefix(tenant_slug: str, site_slug: str, device_key: str) -> str:
    return f"t/{tenant_slug}/s/{site_slug}/d/{device_key}"


def tenant_topic_prefix(tenant_slug: str) -> str:
    return f"t/{tenant_slug}/"
