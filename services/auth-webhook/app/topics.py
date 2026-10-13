from dataclasses import dataclass

# Konvensi topik: t/{tenant_slug}/s/{site_slug}/d/{device_id}/telemetry|status|cmd|resp
DEVICE_PUBLISHABLE_SUFFIXES = {"telemetry", "status", "resp"}
DEVICE_SUBSCRIBABLE_SUFFIXES = {"cmd"}
DASHBOARD_SUBSCRIBABLE_SUFFIXES = {"telemetry", "status", "resp"}
DASHBOARD_PUBLISHABLE_SUFFIXES = {"cmd"}


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


def device_topic_prefix(tenant_slug: str, site_slug: str, device_key: str) -> str:
    return f"t/{tenant_slug}/s/{site_slug}/d/{device_key}"


def tenant_topic_prefix(tenant_slug: str) -> str:
    return f"t/{tenant_slug}/"
