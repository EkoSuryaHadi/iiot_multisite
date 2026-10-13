import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt

from app.config import settings


def hash_secret(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_secret(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def generate_device_password(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def _create_token(
    subject: uuid.UUID,
    tenant_id: uuid.UUID | None,
    role: str,
    token_type: Literal["access", "refresh"],
    expires_delta: timedelta,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: uuid.UUID, tenant_id: uuid.UUID | None, role: str) -> str:
    return _create_token(
        subject, tenant_id, role, "access", timedelta(minutes=settings.jwt_access_expire_minutes)
    )


def create_refresh_token(subject: uuid.UUID, tenant_id: uuid.UUID | None, role: str) -> str:
    return _create_token(
        subject, tenant_id, role, "refresh", timedelta(minutes=settings.jwt_refresh_expire_minutes)
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
