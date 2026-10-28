import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class IncidentSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    MAYOR = "MAYOR"
    MINOR = "MINOR"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class IncidentTicket(Base):
    """Model pelacakan tiket insiden & SLA sesuai RKS Mitratel Pasal 2.6 & 2.5.4."""

    __tablename__ = "incident_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    site_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True
    )
    site_slug: Mapped[str] = mapped_column(String(64), index=True)

    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity, name="incident_severity"), index=True
    )
    category: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Batas SLA dalam Jam (Kritikal: 4h/24h, Mayor: 8h/72h, Minor: 24h/168h)
    sla_response_hours: Mapped[int] = mapped_column(Integer, default=4)
    sla_restoration_hours: Mapped[int] = mapped_column(Integer, default=24)

    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status"), default=IncidentStatus.OPEN, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    site = relationship("Site", backref="incident_tickets")
