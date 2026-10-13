import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "iiot")
os.environ.setdefault("POSTGRES_PASSWORD", "change_me_postgres")
os.environ.setdefault("POSTGRES_DB", "iiot_test")
os.environ.setdefault("JWT_SECRET", "test_secret")

from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, Tenant, User  # noqa: E402
from app.security import hash_secret  # noqa: E402

_admin_url = settings.database_url.rsplit("/", 1)[0] + "/postgres"


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
    yield session

    session.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def client(db_session):
    return TestClient(app)


@pytest.fixture()
def superadmin(db_session):
    user = User(
        tenant_id=None, email="super@iiot-corp.dev", hashed_password=hash_secret("supersecret"), role=Role.SUPERADMIN
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def tenant_a(db_session):
    t = Tenant(slug=f"tenant-a-{uuid.uuid4().hex[:6]}", name="Tenant A")
    db_session.add(t)
    db_session.commit()
    return t


@pytest.fixture()
def tenant_b(db_session):
    t = Tenant(slug=f"tenant-b-{uuid.uuid4().hex[:6]}", name="Tenant B")
    db_session.add(t)
    db_session.commit()
    return t


@pytest.fixture()
def tenant_a_admin(db_session, tenant_a):
    user = User(
        tenant_id=tenant_a.id,
        email="admin-a@iiot-corp.dev",
        hashed_password=hash_secret("secretpw"),
        role=Role.TENANT_ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def tenant_b_admin(db_session, tenant_b):
    user = User(
        tenant_id=tenant_b.id,
        email="admin-b@iiot-corp.dev",
        hashed_password=hash_secret("secretpw"),
        role=Role.TENANT_ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    return user


def auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
