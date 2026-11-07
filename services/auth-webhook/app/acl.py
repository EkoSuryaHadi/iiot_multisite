from sqlalchemy.orm import Session

from app.identity import Identity
from app.lookup import find_device_scope_by_key
from app.models import Role
from app.topics import (
    DASHBOARD_PUBLISHABLE_SUFFIXES,
    DEVICE_PUBLISHABLE_SUFFIXES,
    DEVICE_SUBSCRIBABLE_SUFFIXES,
    parse_device_topic,
    parse_device_topic_lenient,
    tenant_topic_prefix,
)

_DASHBOARD_PUBLISH_ROLES = {Role.TENANT_ADMIN, Role.OPERATOR}


def decide(identity: Identity, topic: str, action: str, db: Session | None = None) -> bool:
    if identity.is_superuser:
        return True

    if identity.kind == "device":
        parsed = parse_device_topic(topic)
        if parsed is None or parsed.suffix in {"#", "+"}:
            # Topik device baru/vendor sering tidak mengikuti konvensi ketat, dan subscribe
            # berakhir dengan wildcard (`.../d/dev-1/#`) sehingga tidak boleh dianggap
            # suffix harfiah "cmd" oleh parser ketat.
            # Tafsirkan longgar, lalu tetap wajib milik device ini.
            parsed = parse_device_topic_lenient(
                topic,
                device_key_hint=identity.device_key,
                tenant_hint=identity.tenant_slug,
                site_hint=identity.site_slug,
            )
        if parsed is not None:
            tenant_ok = parsed.tenant_slug is None or parsed.tenant_slug == identity.tenant_slug
            site_ok = parsed.site_slug is None or parsed.site_slug == identity.site_slug
            device_ok = bool(identity.device_key) and parsed.device_key == identity.device_key
            if tenant_ok and site_ok and device_ok:
                if action == "publish":
                    return parsed.suffix in DEVICE_PUBLISHABLE_SUFFIXES
                if action == "subscribe":
                    return parsed.suffix in DEVICE_SUBSCRIBABLE_SUFFIXES
            return False

        # Mendukung gateway IoT / Haiwell yang mem-publish ke format data/...
        if action == "publish":
            if topic.startswith("data/") and identity.device_key and identity.device_key in topic:
                return True
            # Gateway Haiwell mem-publish atas nama unit/device lain (mis. .../G001) yang
            # terdaftar di tenant + site yang sama dengan gateway, atau otomatis di-register jika baru.
            if topic.startswith("data/") and db is not None:
                target_key = topic.split("/")[-1]
                if target_key and target_key not in {"+", "#"}:
                    scope = find_device_scope_by_key(db, target_key)
                    if scope is not None and scope == (identity.tenant_slug, identity.site_slug):
                        return True
                    # Jika belum terdaftar, otomatis daftarkan sebagai status 'pending'
                    if scope is None and identity.tenant_slug and identity.site_slug:
                        from app.lookup import auto_register_pending_device
                        registered = auto_register_pending_device(
                            db, identity.tenant_slug, identity.site_slug, target_key
                        )
                        if registered:
                            return True

        if action == "subscribe":
            if topic in {"#", "data/#"} or topic.startswith("data/") or topic.startswith("cmd/"):
                return True

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
