import hmac
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

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
        if not verify_secret(password, device_row.hashed_password):
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
        if not verify_secret(password, user_row.hashed_password):
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
