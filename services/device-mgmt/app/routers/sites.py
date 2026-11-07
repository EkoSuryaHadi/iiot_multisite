import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, require_admin, resolve_tenant_scope
from app.models import Role, Site
from app.schemas import SiteCreate, SiteOut, SiteUpdate

router = APIRouter(prefix="/sites", tags=["sites"])


def _scoped_query(current_user: CurrentUser):
    stmt = select(Site)
    if current_user.role != Role.SUPERADMIN:
        stmt = stmt.where(Site.tenant_id == current_user.tenant_id)
    return stmt


@router.post("", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
) -> Site:
    tenant_id = resolve_tenant_scope(current_user, payload.tenant_id)

    exists = db.scalar(select(Site).where(Site.tenant_id == tenant_id, Site.slug == payload.slug))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug site sudah dipakai di tenant ini")

    site_data = payload.model_dump(exclude={"tenant_id"})
    site = Site(tenant_id=tenant_id, **site_data)
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.get("", response_model=list[SiteOut])
def list_sites(
    db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> list[Site]:
    return list(db.scalars(_scoped_query(current_user).order_by(Site.created_at)))


@router.get("/{site_id}", response_model=SiteOut)
def get_site(
    site_id: uuid.UUID, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> Site:
    site = db.scalar(_scoped_query(current_user).where(Site.id == site_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site tidak ditemukan")
    return site


@router.patch("/{site_id}", response_model=SiteOut)
def update_site(
    site_id: uuid.UUID,
    payload: SiteUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> Site:
    site = db.scalar(_scoped_query(current_user).where(Site.id == site_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site tidak ditemukan")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(site, field, value)

    db.commit()
    db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(
    site_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> None:
    site = db.scalar(_scoped_query(current_user).where(Site.id == site_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site tidak ditemukan")
    db.delete(site)
    db.commit()
