"""Mirror read-only dari tabel yang dimiliki & dimigrasikan oleh service device-mgmt.
Hanya dipakai untuk resolusi tenant_id (klaim JWT) -> tenant_slug (dipakai di ClickHouse).
"""
import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database_pg import PgBase


class Tenant(PgBase):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean)
