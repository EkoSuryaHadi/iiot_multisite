from fastapi import Header, HTTPException, status

from app.config import settings


def verify_mitratel_api_key(
    x_mitratel_api_key: str | None = Header(
        default=None,
        alias="X-Mitratel-API-Key",
        description="API Key khusus Mitratel untuk otentikasi Open RESTful API",
    ),
) -> str:
    """Verifikasi API Key penarikan data mandiri Mitratel sesuai RKS 2.3.3.c butir 5.

    Menolak akses dengan HTTP 401 Unauthorized bila header X-Mitratel-API-Key tidak cocok.
    """
    if not x_mitratel_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Mitratel-API-Key header",
        )

    valid_keys = [k.strip() for k in settings.mitratel_api_key.split(",") if k.strip()]
    if x_mitratel_api_key not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Mitratel-API-Key header",
        )

    return x_mitratel_api_key
