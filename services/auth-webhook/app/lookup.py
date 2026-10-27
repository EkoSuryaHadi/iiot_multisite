"""Lookup data dari Postgres dengan TTL cache di depannya.

Yang di-cache hanyalah *data* (hash password + metadata), bukan hasil verifikasi -
password tetap diverifikasi ulang (bcrypt) setiap request, supaya kredensial yang
salah selalu ditolak meskipun baris cache belum expired.
"""
from dataclasses import dataclass

from sqlalchemy import or_, select
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
        clean_key = client_id.split("/")[0].strip()
        row = db.scalar(
            select(DeviceCredential)
            .join(Device, Device.id == DeviceCredential.device_id)
            .where(
                or_(
                    DeviceCredential.client_id == client_id,
                    DeviceCredential.client_id == clean_key,
                    Device.device_key == client_id,
                    Device.device_key == clean_key,
                )
            )
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


def find_device_scope_by_key(db: Session, device_key: str) -> tuple[str, str] | None:
    """Kembalikan (tenant_slug, site_slug) untuk device aktif dengan device_key tertentu."""

    def _load() -> tuple[str, str] | None:
        device = db.scalar(select(Device).where(Device.device_key == device_key, Device.is_active.is_(True)))
        if device is None or not (device.site.is_active and device.tenant.is_active):
            return None
        return (device.tenant.slug, device.site.slug)

    return authn_cache.get_or_set(f"devscope:{device_key}", _load)


def auto_register_pending_device(
    db: Session, gateway_tenant_slug: str, gateway_site_slug: str, target_device_key: str
) -> bool:
    """Otomatis daftarkan device baru yang dipublish gateway ke database sebagai pending."""
    import uuid
    from app.models import Tenant, Site

    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == gateway_tenant_slug, Tenant.is_active.is_(True)))
        if not tenant:
            return False
        site = db.scalar(select(Site).where(Site.slug == gateway_site_slug, Site.tenant_id == tenant.id, Site.is_active.is_(True)))
        if not site:
            return False

        existing = db.scalar(select(Device).where(Device.device_key == target_device_key, Device.tenant_id == tenant.id))
        if existing:
            return True

        new_dev = Device(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            site_id=site.id,
            device_key=target_device_key,
            name=f"New Device ({target_device_key})",
            is_active=True,
            registration_status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_dev)
        db.commit()
        authn_cache.invalidate(f"devscope:{target_device_key}")
        return True
    except Exception:
        db.rollback()
        return False


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
