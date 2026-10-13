"""Lookup data dari Postgres dengan TTL cache di depannya.

Yang di-cache hanyalah *data* (hash password + metadata), bukan hasil verifikasi -
password tetap diverifikasi ulang (bcrypt) setiap request, supaya kredensial yang
salah selalu ditolak meskipun baris cache belum expired.
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import authn_cache
from app.models import Device, DeviceCredential, Role, User


@dataclass
class DeviceRow:
    hashed_password: str
    tenant_slug: str
    site_slug: str
    device_key: str
    device_active: bool
    site_active: bool
    tenant_active: bool


@dataclass
class UserRow:
    hashed_password: str
    tenant_slug: str | None
    role: Role
    is_active: bool


def find_device_by_client_id(db: Session, client_id: str) -> DeviceRow | None:
    def _load() -> DeviceRow | None:
        row = db.scalar(
            select(DeviceCredential).where(DeviceCredential.client_id == client_id)
        )
        if row is None:
            return None
        device: Device = row.device
        return DeviceRow(
            hashed_password=row.hashed_password,
            tenant_slug=device.tenant.slug,
            site_slug=device.site.slug,
            device_key=device.device_key,
            device_active=device.is_active,
            site_active=device.site.is_active,
            tenant_active=device.tenant.is_active,
        )

    return authn_cache.get_or_set(f"device:{client_id}", _load)


def find_user_by_email(db: Session, email: str) -> UserRow | None:
    def _load() -> UserRow | None:
        row = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
        if row is None:
            return None
        return UserRow(
            hashed_password=row.hashed_password,
            tenant_slug=row.tenant.slug if row.tenant else None,
            role=row.role,
            is_active=row.is_active,
        )

    return authn_cache.get_or_set(f"user:{email}", _load)
