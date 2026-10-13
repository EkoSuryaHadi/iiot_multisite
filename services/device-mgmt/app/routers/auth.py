import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, RefreshRequest, TokenPair
from app.security import create_access_token, create_refresh_token, decode_token, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    """Login memakai email + password (bukan username OAuth2 standar)."""
    users = db.scalars(select(User).where(User.email == payload.email, User.is_active.is_(True))).all()
    user = next((u for u in users if verify_secret(payload.password, u.hashed_password)), None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email atau password salah")

    return TokenPair(
        access_token=create_access_token(user.id, user.tenant_id, user.role.value),
        refresh_token=create_refresh_token(user.id, user.tenant_id, user.role.value),
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
        access_token=create_access_token(user.id, user.tenant_id, user.role.value),
        refresh_token=create_refresh_token(user.id, user.tenant_id, user.role.value),
    )
