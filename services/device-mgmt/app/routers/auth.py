import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, _now
from app.schemas import ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, RefreshRequest, TokenPair
from app.security import create_access_token, create_refresh_token, decode_token, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    """Login memakai username atau email + password."""
    ident = (payload.identifier or payload.email or "").strip()
    users = db.scalars(
        select(User).where(or_(User.email == ident, User.username == ident), User.is_active.is_(True))
    ).all()
    user = next((u for u in users if verify_secret(payload.password, u.hashed_password)), None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Username/email atau password salah")

    return TokenPair(
        access_token=create_access_token(user.id, user.tenant_id, user.role.value, site_id=user.site_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id, user.role.value, site_id=user.site_id),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    """Catat permintaan reset password untuk ditindaklanjuti oleh Admin/Superadmin."""
    ident = payload.identifier.strip()
    users = db.scalars(
        select(User).where(or_(User.email == ident, User.username == ident), User.is_active.is_(True))
    ).all()
    for user in users:
        user.password_reset_requested_at = _now()
    if users:
        db.commit()

    return ForgotPasswordResponse(
        message="Jika akun terdaftar, permintaan reset password telah dicatat. Silakan hubungi admin untuk penetapan password baru."
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token tidak valid")
    try:
        data = decode_token(payload.refresh_token)
    except jwt.PyJWTError:
        raise error

    if data.get("type") != "refresh":
        raise error

    user = db.get(User, uuid.UUID(data["sub"]))
    if user is None or not user.is_active:
        raise error

    return TokenPair(
        access_token=create_access_token(user.id, user.tenant_id, user.role.value, site_id=user.site_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id, user.role.value, site_id=user.site_id),
    )
