from app.identity import Identity
from app.models import Role
from app.topics import (
    DASHBOARD_PUBLISHABLE_SUFFIXES,
    DEVICE_PUBLISHABLE_SUFFIXES,
    DEVICE_SUBSCRIBABLE_SUFFIXES,
    parse_device_topic,
    tenant_topic_prefix,
)

_DASHBOARD_PUBLISH_ROLES = {Role.TENANT_ADMIN, Role.OPERATOR}


def decide(identity: Identity, topic: str, action: str) -> bool:
    if identity.is_superuser:
        return True

    if identity.kind == "device":
        parsed = parse_device_topic(topic)
        if parsed is None:
            return False
        if (
            parsed.tenant_slug != identity.tenant_slug
            or parsed.site_slug != identity.site_slug
            or parsed.device_key != identity.device_key
        ):
            return False
        if action == "publish":
            return parsed.suffix in DEVICE_PUBLISHABLE_SUFFIXES
        if action == "subscribe":
            return parsed.suffix in DEVICE_SUBSCRIBABLE_SUFFIXES
        return False

    if identity.kind == "user":
        if identity.tenant_slug is None:
            return False
        if not topic.startswith(tenant_topic_prefix(identity.tenant_slug)):
            return False
        if action == "subscribe":
            return True
        if action == "publish":
            parsed = parse_device_topic(topic)
            if parsed is None:
                return False
            return identity.role in _DASHBOARD_PUBLISH_ROLES and parsed.suffix in DASHBOARD_PUBLISHABLE_SUFFIXES
        return False

    return False
