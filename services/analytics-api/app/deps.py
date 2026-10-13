import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import tenant_slug_cache
from app.database_pg import get_pg_db
from app.models_pg import Tenant
from app.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)

SUPERADMIN_ROLE = "superadmin"


@dataclass
class CurrentUser:
    id: uuid.UUID
    tenant_id: uuid.UUID | None
    tenant_slug: str | None
    role: str

    @property
    def is_superadmin(self) -> bool:
        return self.role == SUPERADMIN_ROLE


def _resolve_tenant_slug(db: Session, tenant_id: uuid.UUID) -> str | None:
    def _load() -> str | None:
        tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active.is_(True)))
        return tenant.slug if tenant else None

    return tenant_slug_cache.get_or_set(str(tenant_id), _load)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_pg_db),
) -> CurrentUser:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau sudah kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_error

    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise credentials_error

    if payload.get("type") != "access":
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    tenant_id_raw = payload.get("tenant_id")
    tenant_id = uuid.UUID(tenant_id_raw) if tenant_id_raw else None
    tenant_slug = _resolve_tenant_slug(db, tenant_id) if tenant_id else None

    role = payload.get("role", "viewer")
    if tenant_id is not None and tenant_slug is None and role != SUPERADMIN_ROLE:
        # Tenant sudah dihapus / nonaktif tapi token lama masih dipakai.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant tidak aktif")

    return CurrentUser(id=uuid.UUID(user_id), tenant_id=tenant_id, tenant_slug=tenant_slug, role=role)


def resolve_tenant_scope(current_user: CurrentUser, requested_tenant_slug: str | None) -> str:
    """Tentukan tenant_slug efektif untuk query.

    - superadmin boleh menentukan tenant_slug secara eksplisit (wajib diisi).
    - role lain selalu dipaksa memakai tenant_slug dari klaim JWT miliknya sendiri.
    """
    if current_user.is_superadmin:
        if not requested_tenant_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tenant_slug wajib diisi untuk superadmin",
            )
        return requested_tenant_slug

    if current_user.tenant_slug is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User tidak terasosiasi dengan tenant manapun",
        )
    return current_user.tenant_slug
