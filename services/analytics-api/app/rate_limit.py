import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings


def get_rate_limit_key(request: Request) -> str:
    """Gunakan identitas user (JWT sub) atau X-Forwarded-For agar request via
    Next.js BFF container tidak berbagi satu bucket rate-limit untuk semua user.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except jwt.PyJWTError:
            pass

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}"

    return get_remote_address(request)


limiter = Limiter(key_func=get_rate_limit_key)
