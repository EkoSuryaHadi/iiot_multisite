import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_admin, resolve_tenant_scope
from app.models import Role, User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import hash_secret

router = APIRouter(prefix="/users", tags=["users"])


def _scoped_query(current_user: CurrentUser):
    stmt = select(User)
    if current_user.role != Role.SUPERADMIN:
        stmt = stmt.where(User.tenant_id == current_user.tenant_id)
    return stmt


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
) -> User:
    if payload.role == Role.SUPERADMIN and current_user.role != Role.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Hanya superadmin yang boleh membuat superadmin"
        )

    tenant_id = None if payload.role == Role.SUPERADMIN else resolve_tenant_scope(current_user, payload.tenant_id)

    exists = db.scalar(select(User).where(User.tenant_id == tenant_id, User.email == payload.email))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah terdaftar di tenant ini")

    user = User(
        tenant_id=tenant_id,
        email=payload.email,
        hashed_password=hash_secret(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
) -> list[User]:
    return list(db.scalars(_scoped_query(current_user).order_by(User.created_at)))


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: uuid.UUID, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
) -> User:
    user = db.scalar(_scoped_query(current_user).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> User:
    user = db.scalar(_scoped_query(current_user).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        user.hashed_password = hash_secret(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> None:
    user = db.scalar(_scoped_query(current_user).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")
    db.delete(user)
    db.commit()
