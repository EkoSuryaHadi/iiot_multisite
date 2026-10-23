import hashlib
import hmac
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.cache import verified_password_cache
from app.config import settings
from app.lookup import find_device_by_client_id, find_user_by_email
from app.models import Role
from app.security import verify_secret

IdentityKind = Literal["device", "user", "internal"]


@dataclass
class Identity:
    kind: IdentityKind
    is_superuser: bool
    tenant_slug: str | None = None
    site_slug: str | None = None
    device_key: str | None = None
    role: Role | None = None


def _verify_cached(subject_key: str, plain_password: str, hashed_password: str) -> bool:
    """Hindari komputasi ulang bcrypt (~60-100ms) selama pasangan (plain, hashed) masih sama di dalam TTL."""
    candidate_digest = hashlib.sha256(f"{hashed_password}:{plain_password}".encode("utf-8")).hexdigest()
    cached_digest = verified_password_cache.get_or_set(subject_key, lambda: None)
    if cached_digest is not None and hmac.compare_digest(cached_digest, candidate_digest):
        return True
    if verify_secret(plain_password, hashed_password):
        verified_password_cache.invalidate(subject_key)
        verified_password_cache.get_or_set(subject_key, lambda: candidate_digest)
        return True
    return False


def authenticate(db: Session, username: str | None, password: str | None) -> Identity | None:
    """Autentikasi 3 skenario: service internal (superuser), device, dan user dashboard."""
    if not username or password is None:
        return None

    # 1. Service internal (misal Rule Engine HTTP action / ingestor) - superuser penuh.
    if hmac.compare_digest(username, settings.internal_service_username):
        if hmac.compare_digest(password, settings.internal_service_password):
            return Identity(kind="internal", is_superuser=True)
        return None

    # 2. Device MQTT (username = client_id hasil provisioning di device-mgmt).
    device_row = find_device_by_client_id(db, username)
    if device_row is not None:
        if not (device_row.device_active and device_row.site_active and device_row.tenant_active):
            return None
        if not _verify_cached(f"dev:{username}", password, device_row.hashed_password):
            return None
        return Identity(
            kind="device",
            is_superuser=False,
            tenant_slug=device_row.tenant_slug,
            site_slug=device_row.site_slug,
            device_key=device_row.device_key,
        )

    # 3. User dashboard (username = email, password sama dengan login device-mgmt).
    user_row = find_user_by_email(db, username)
    if user_row is not None:
        if not _verify_cached(f"usr:{username}", password, user_row.hashed_password):
            return None
        return Identity(
            kind="user",
            is_superuser=(user_row.role == Role.SUPERADMIN),
            tenant_slug=user_row.tenant_slug,
            role=user_row.role,
        )

    return None


def resolve_identity_for_authz(db: Session, username: str | None) -> Identity | None:
    """Resolusi identitas untuk keputusan ACL (authz). Tidak memverifikasi password
    lagi - EMQX hanya memanggil /authz untuk klien yang sudah lolos /authn sebelumnya.
    """
    if not username:
        return None

    if hmac.compare_digest(username, settings.internal_service_username):
        return Identity(kind="internal", is_superuser=True)

    device_row = find_device_by_client_id(db, username)
    if device_row is not None:
        if not (device_row.device_active and device_row.site_active and device_row.tenant_active):
            return None
        return Identity(
            kind="device",
            is_superuser=False,
            tenant_slug=device_row.tenant_slug,
            site_slug=device_row.site_slug,
            device_key=device_row.device_key,
        )

    user_row = find_user_by_email(db, username)
    if user_row is not None:
        return Identity(
            kind="user",
            is_superuser=(user_row.role == Role.SUPERADMIN),
            tenant_slug=user_row.tenant_slug,
            role=user_row.role,
        )

    return None
