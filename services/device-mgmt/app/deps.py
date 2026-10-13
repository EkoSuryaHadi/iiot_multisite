import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, User
from app.security import decode_token

# Bearer token sederhana: login dilakukan lewat POST /auth/login (JSON email+password),
# lalu access_token yang didapat ditempel di sini. Tidak memakai OAuth2PasswordBearer
# karena login API ini bukan form OAuth2 password grant (field-nya email, bukan username).
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: uuid.UUID
    tenant_id: uuid.UUID | None
    role: Role


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
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

    user = db.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_error

    return CurrentUser(id=user.id, tenant_id=user.tenant_id, role=user.role)


def require_roles(*roles: Role):
    def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anda tidak memiliki izin untuk aksi ini",
            )
        return current_user

    return _checker


# Dependency bersama: admin (tenant_admin ke atas) boleh mengelola site/user/device.
require_admin = require_roles(Role.SUPERADMIN, Role.TENANT_ADMIN)
# Dependency bersama: operator ke atas boleh mengelola device & kredensialnya.
require_operator = require_roles(Role.SUPERADMIN, Role.TENANT_ADMIN, Role.OPERATOR)


def resolve_tenant_scope(current_user: CurrentUser, requested_tenant_id: uuid.UUID | None) -> uuid.UUID:
    """Tentukan tenant_id efektif untuk operasi tulis/baca.

    - superadmin boleh menentukan tenant_id secara eksplisit (wajib diisi).
    - role lain selalu dipaksa memakai tenant_id dari klaim JWT miliknya sendiri.
    """
    if current_user.role == Role.SUPERADMIN:
        if requested_tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tenant_id wajib diisi untuk superadmin",
            )
        return requested_tenant_id

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User tidak terasosiasi dengan tenant manapun",
        )
    return current_user.tenant_id
