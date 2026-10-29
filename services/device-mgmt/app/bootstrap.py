"""Bootstrap superadmin pertama. Idempotent - aman dijalankan berulang kali.

Jalankan dengan:
    docker compose exec device-mgmt python -m app.bootstrap
Env opsional: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD (default itdev@gaungnusa.com / dolphin)
"""
import os

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_secret


def main() -> None:
    email = os.environ.get("SUPERADMIN_EMAIL", "itdev@gaungnusa.com")
    password = os.environ.get("SUPERADMIN_PASSWORD", "dolphin")

    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.tenant_id.is_(None), User.email == email))
        if existing:
            print(f"Superadmin '{email}' sudah ada, tidak ada perubahan di Postgres.")
        else:
            user = User(
                tenant_id=None,
                email=email,
                hashed_password=hash_secret(password),
                role=Role.SUPERADMIN,
            )
            db.add(user)
            db.commit()
            print(f"Superadmin '{email}' berhasil dibuat di Postgres.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
