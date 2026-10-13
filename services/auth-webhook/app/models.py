"""Mirror read-only dari skema yang dimiliki & dimigrasikan oleh service device-mgmt.

auth-webhook TIDAK menjalankan migration sendiri - tabel sudah ada di database
`iiot` yang sama. Model di sini hanya dipakai untuk query SELECT.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    SUPERADMIN = "superadmin"
    TENANT_ADMIN = "tenant_admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean)


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    slug: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))
    is_active: Mapped[bool] = mapped_column(Boolean)

    tenant: Mapped["Tenant | None"] = relationship(viewonly=True)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sites.id"))
    device_key: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean)

    tenant: Mapped["Tenant"] = relationship(viewonly=True)
    site: Mapped["Site"] = relationship(viewonly=True)
    credential: Mapped["DeviceCredential | None"] = relationship(viewonly=True, uselist=False)


class DeviceCredential(Base):
    __tablename__ = "device_credentials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"))
    client_id: Mapped[str] = mapped_column(String(128))
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    device: Mapped["Device"] = relationship(viewonly=True)
