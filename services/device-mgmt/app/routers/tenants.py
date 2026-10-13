import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import Role, Tenant
from app.schemas import TenantCreate, TenantOut, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])

# Tenant hanya boleh dikelola superadmin (lintas tenant by definition).
_require_superadmin = require_roles(Role.SUPERADMIN)


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate, db: Session = Depends(get_db), _: object = Depends(_require_superadmin)
) -> Tenant:
    if db.scalar(select(Tenant).where(Tenant.slug == payload.slug)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug tenant sudah dipakai")

    tenant = Tenant(slug=payload.slug, name=payload.name)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("", response_model=list[TenantOut])
def list_tenants(db: Session = Depends(get_db), _: object = Depends(_require_superadmin)) -> list[Tenant]:
    return list(db.scalars(select(Tenant).order_by(Tenant.created_at)))


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: uuid.UUID, db: Session = Depends(get_db), _: object = Depends(_require_superadmin)
) -> Tenant:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant tidak ditemukan")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(_require_superadmin),
) -> Tenant:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant tidak ditemukan")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: uuid.UUID, db: Session = Depends(get_db), _: object = Depends(_require_superadmin)
) -> None:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant tidak ditemukan")
    db.delete(tenant)
    db.commit()
