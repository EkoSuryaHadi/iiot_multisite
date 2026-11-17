import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models import Role, SiteConfigurationType


# --- Auth ---
class LoginRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    password: str

    @model_validator(mode="after")
    def _validate_identifier(self) -> "LoginRequest":
        ident = (self.identifier or self.email or "").strip()
        if not ident:
            raise ValueError("Username atau email wajib diisi")
        self.identifier = ident
        return self


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)


class ForgotPasswordResponse(BaseModel):
    message: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# --- Tenant ---
class TenantCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=128)


class TenantUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    is_active: bool
    created_at: datetime


# --- Site ---
class SiteCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=128)
    tenant_id: uuid.UUID | None = None  # hanya dipakai superadmin; tenant lain diambil dari JWT
    site_type: SiteConfigurationType | None = None
    pv_capacity_kwp: float | None = None
    mppt_capacity_a: float | None = None
    rectifier_float_voltage: float | None = None
    baseline_kwh_daily: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    tower_type: str | None = None


class SiteUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    site_type: SiteConfigurationType | None = None
    pv_capacity_kwp: float | None = None
    mppt_capacity_a: float | None = None
    rectifier_float_voltage: float | None = None
    baseline_kwh_daily: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    tower_type: str | None = None


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    slug: str
    name: str
    is_active: bool
    created_at: datetime
    site_type: SiteConfigurationType | None = None
    pv_capacity_kwp: float | None = None
    mppt_capacity_a: float | None = None
    rectifier_float_voltage: float | None = None
    baseline_kwh_daily: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    tower_type: str | None = None


# --- User ---
class UserCreate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    email: EmailStr | None = None
    password: str = Field(min_length=6)
    role: Role
    tenant_id: uuid.UUID | None = None  # hanya dipakai superadmin; tenant lain diambil dari JWT
    site_id: uuid.UUID | None = None  # opsional: batasi user ke 1 child site tertentu

    @model_validator(mode="after")
    def _require_username_or_email(self) -> "UserCreate":
        if not self.username and not self.email:
            raise ValueError("Username atau email wajib diisi")
        return self


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    role: Role | None = None
    is_active: bool | None = None
    site_id: uuid.UUID | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None
    site_id: uuid.UUID | None = None
    username: str | None = None
    email: str | None = None
    role: Role
    is_active: bool
    password_reset_requested_at: datetime | None = None
    created_at: datetime


# --- Device Asset ---
class DeviceAssetCreate(BaseModel):
    asset_type: str = Field(min_length=1, max_length=64)
    brand: str | None = None
    model: str | None = None
    serial_number: str = Field(min_length=1, max_length=128)
    warranty_years: int | None = 2
    is_spare: bool = False
    installed_at: datetime | None = None


class DeviceAssetUpdate(BaseModel):
    asset_type: str | None = None
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    warranty_years: int | None = None
    is_spare: bool | None = None
    installed_at: datetime | None = None


class DeviceAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID
    asset_type: str
    brand: str | None = None
    model: str | None = None
    serial_number: str
    warranty_years: int | None = None
    is_spare: bool
    installed_at: datetime | None = None
    created_at: datetime


# --- Device ---
class DeviceCreate(BaseModel):
    device_key: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=1, max_length=128)
    site_id: uuid.UUID
    tenant_id: uuid.UUID | None = None  # hanya dipakai superadmin; tenant lain diambil dari JWT


class DeviceUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: uuid.UUID
    device_key: str
    name: str
    is_active: bool
    registration_status: str = "active"
    has_credential: bool = False
    created_at: datetime
    assets: list[DeviceAssetOut] = []


class DeviceClaimRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    site_id: uuid.UUID
    tenant_id: uuid.UUID | None = None  # Hanya untuk superadmin


class DeviceCredentialOut(BaseModel):
    client_id: str
    password: str
    mqtt_topic_prefix: str

