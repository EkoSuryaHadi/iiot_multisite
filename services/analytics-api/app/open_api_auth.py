from fastapi import Header, HTTPException, status

from app.config import settings


def verify_mitratel_api_key(
    x_api_key: str | None = Header(
        default=None,
        alias="X-API-Key",
        description="API Key untuk otentikasi Open RESTful API",
    ),
    x_mitratel_api_key: str | None = Header(
        default=None,
        alias="X-Mitratel-API-Key",
        description="Legacy header API Key Mitratel",
    ),
) -> str:
    """Verifikasi API Key penarikan data mandiri via Open RESTful API.

    Mendukung header `X-API-Key` standar dan `X-Mitratel-API-Key`.
    Menolak akses dengan HTTP 401 Unauthorized bila header tidak cocok.
    """
    key_candidate = x_api_key or x_mitratel_api_key
    if not key_candidate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )

    valid_keys = [k.strip() for k in settings.mitratel_api_key.split(",") if k.strip()]
    if key_candidate not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )

    return key_candidate

