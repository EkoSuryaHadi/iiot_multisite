import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, require_admin, require_operator, resolve_tenant_scope
from app.models import Device, DeviceAsset, DeviceCredential, Role, Site, _now
from app.schemas import (
    DeviceAssetCreate,
    DeviceAssetOut,
    DeviceClaimRequest,
    DeviceCreate,
    DeviceCredentialOut,
    DeviceOut,
    DeviceUpdate,
)
from app.security import generate_device_password, hash_secret

router = APIRouter(prefix="/devices", tags=["devices"])


def _scoped_query(current_user: CurrentUser):
    stmt = select(Device)
    if current_user.role != Role.SUPERADMIN:
        stmt = stmt.where(Device.tenant_id == current_user.tenant_id)
    return stmt


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_operator)
) -> Device:
    tenant_id = resolve_tenant_scope(current_user, payload.tenant_id)

    site = db.scalar(select(Site).where(Site.id == payload.site_id, Site.tenant_id == tenant_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site tidak ditemukan di tenant ini")

    exists = db.scalar(
        select(Device).where(Device.tenant_id == tenant_id, Device.device_key == payload.device_key)
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="device_key sudah dipakai di tenant ini")

    device = Device(tenant_id=tenant_id, site_id=site.id, device_key=payload.device_key, name=payload.name)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> list[Device]:
    return list(db.scalars(_scoped_query(current_user).order_by(Device.created_at)))


@router.get("/pending", response_model=list[DeviceOut])
def list_pending_devices(
    db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> list[Device]:
    stmt = _scoped_query(current_user).where(Device.registration_status == "pending").order_by(Device.created_at.desc())
    return list(db.scalars(stmt))


@router.post("/{device_id}/claim", response_model=DeviceOut)
def claim_device(
    device_id: uuid.UUID,
    payload: DeviceClaimRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> Device:
    target_tenant_id = resolve_tenant_scope(current_user, payload.tenant_id)

    # Validasi site tujuan
    site = db.scalar(select(Site).where(Site.id == payload.site_id, Site.tenant_id == target_tenant_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site tidak ditemukan di tenant ini")

    # Cari device
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")

    device.tenant_id = target_tenant_id
    device.site_id = site.id
    device.name = payload.name
    device.registration_status = "active"

    db.commit()
    db.refresh(device)
    return device


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(
    device_id: uuid.UUID, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
) -> Device:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")
    return device


@router.patch("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> Device:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)

    db.commit()
    db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> None:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")
    db.delete(device)
    db.commit()


@router.post("/{device_id}/credentials", response_model=DeviceCredentialOut)
def provision_credentials(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> DeviceCredentialOut:
    """Generate (atau rotasi) kredensial MQTT device. Password plaintext hanya dikembalikan sekali."""
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")

    tenant = device.tenant
    site = device.site
    client_id = f"{tenant.slug}-{site.slug}-{device.device_key}"
    plain_password = generate_device_password()

    if device.credential is None:
        credential = DeviceCredential(
            device_id=device.id, client_id=client_id, hashed_password=hash_secret(plain_password)
        )
        db.add(credential)
    else:
        credential = device.credential
        credential.client_id = client_id
        credential.hashed_password = hash_secret(plain_password)
        credential.rotated_at = _now()

    db.commit()

    return DeviceCredentialOut(
        client_id=client_id,
        password=plain_password,
        mqtt_topic_prefix=f"t/{tenant.slug}/s/{site.slug}/d/{device.device_key}",
    )


@router.post("/{device_id}/assets", response_model=DeviceAssetOut, status_code=status.HTTP_201_CREATED)
def create_device_asset(
    device_id: uuid.UUID,
    payload: DeviceAssetCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> DeviceAsset:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")

    exists = db.scalar(
        select(DeviceAsset).where(
            DeviceAsset.device_id == device.id, DeviceAsset.serial_number == payload.serial_number
        )
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nomor seri aset sudah terdaftar pada device ini",
        )

    asset = DeviceAsset(
        device_id=device.id,
        **payload.model_dump(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{device_id}/assets", response_model=list[DeviceAssetOut])
def list_device_assets(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[DeviceAsset]:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")
    return list(
        db.scalars(
            select(DeviceAsset).where(DeviceAsset.device_id == device.id).order_by(DeviceAsset.created_at)
        )
    )


@router.delete("/{device_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_asset(
    device_id: uuid.UUID,
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> None:
    device = db.scalar(_scoped_query(current_user).where(Device.id == device_id))
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device tidak ditemukan")

    asset = db.scalar(
        select(DeviceAsset).where(DeviceAsset.id == asset_id, DeviceAsset.device_id == device.id)
    )
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aset tidak ditemukan")

    db.delete(asset)
    db.commit()

