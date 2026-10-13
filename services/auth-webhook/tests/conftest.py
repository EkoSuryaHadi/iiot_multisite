import os
import uuid
from datetime import datetime, timezone

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "iiot")
os.environ.setdefault("POSTGRES_PASSWORD", "change_me_postgres")
os.environ.setdefault("POSTGRES_DB", "iiot_webhook_test")
os.environ.setdefault("CACHE_TTL_SECONDS", "30")
os.environ.setdefault("INTERNAL_SERVICE_USERNAME", "internal-service")
os.environ.setdefault("INTERNAL_SERVICE_PASSWORD", "internal-secret")

from app.cache import authn_cache  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Device, DeviceCredential, Role, Site, Tenant, User  # noqa: E402

_admin_url = settings.database_url.rsplit("/", 1)[0] + "/postgres"


def _hash(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _ensure_test_database() -> None:
    admin_engine = create_engine(_admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": settings.postgres_db}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{settings.postgres_db}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session")
def engine():
    _ensure_test_database()
    eng = create_engine(settings.database_url)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    SessionTest = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = SessionTest()

    def _override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    authn_cache.clear()
    yield session

    session.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)
    authn_cache.clear()


@pytest.fixture()
def client(db_session):
    return TestClient(app)


@pytest.fixture()
def tenant_a(db_session):
    t = Tenant(id=uuid.uuid4(), slug=f"tenant-a-{uuid.uuid4().hex[:6]}", is_active=True)
    db_session.add(t)
    db_session.commit()
    return t


@pytest.fixture()
def tenant_b(db_session):
    t = Tenant(id=uuid.uuid4(), slug=f"tenant-b-{uuid.uuid4().hex[:6]}", is_active=True)
    db_session.add(t)
    db_session.commit()
    return t


@pytest.fixture()
def site_a(db_session, tenant_a):
    s = Site(id=uuid.uuid4(), tenant_id=tenant_a.id, slug="site-1", is_active=True)
    db_session.add(s)
    db_session.commit()
    return s


@pytest.fixture()
def device_a(db_session, tenant_a, site_a):
    device = Device(id=uuid.uuid4(), tenant_id=tenant_a.id, site_id=site_a.id, device_key="dev-1", is_active=True)
    db_session.add(device)
    db_session.flush()

    credential = DeviceCredential(
        id=uuid.uuid4(),
        device_id=device.id,
        client_id=f"{tenant_a.slug}-{site_a.slug}-dev-1",
        hashed_password=_hash("device-secret"),
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(credential)
    db_session.commit()
    return device


@pytest.fixture()
def viewer_a(db_session, tenant_a):
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        email="viewer-a@iiot-corp.dev",
        hashed_password=_hash("viewerpw"),
        role=Role.VIEWER,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def tenant_admin_a(db_session, tenant_a):
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        email="admin-a@iiot-corp.dev",
        hashed_password=_hash("adminpw"),
        role=Role.TENANT_ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user
