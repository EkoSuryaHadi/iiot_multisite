import os
import uuid
from datetime import datetime, timezone

import clickhouse_connect
import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("CLICKHOUSE_HOST", "clickhouse")
os.environ.setdefault("CLICKHOUSE_PORT", "8123")
os.environ.setdefault("CLICKHOUSE_USER", "iiot")
os.environ.setdefault("CLICKHOUSE_PASSWORD", "change_me_clickhouse")
os.environ.setdefault("CLICKHOUSE_DB", "iiot_test")
os.environ.setdefault("POSTGRES_HOST", "postgres")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "iiot")
os.environ.setdefault("POSTGRES_PASSWORD", "change_me_postgres")
os.environ.setdefault("POSTGRES_DB", "iiot_analytics_test")
os.environ.setdefault("JWT_SECRET", "test_secret")

from app.buffer import device_status_buffer, telemetry_buffer  # noqa: E402
from app.cache import tenant_slug_cache  # noqa: E402
from app.config import settings  # noqa: E402
from app.database_pg import PgBase  # noqa: E402
from app.main import app  # noqa: E402
from app.models_pg import Tenant  # noqa: E402

_CH_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS telemetry
    (
        tenant_slug  LowCardinality(String),
        site_slug    LowCardinality(String),
        device_key   LowCardinality(String),
        metric_name  LowCardinality(String),
        metric_value Float64,
        ts           DateTime64(3, 'UTC'),
        raw_payload  String DEFAULT '',
        inserted_at  DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(ts)
    ORDER BY (tenant_slug, site_slug, device_key, metric_name, ts)
    """,
    """
    CREATE TABLE IF NOT EXISTS device_status
    (
        tenant_slug LowCardinality(String),
        site_slug   LowCardinality(String),
        device_key  LowCardinality(String),
        status      LowCardinality(String),
        ts          DateTime64(3, 'UTC'),
        raw_payload String DEFAULT '',
        inserted_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(ts)
    ORDER BY (tenant_slug, site_slug, device_key, ts)
    """,
    """
    CREATE TABLE IF NOT EXISTS telemetry_agg_1m
    (
        tenant_slug LowCardinality(String),
        site_slug   LowCardinality(String),
        device_key  LowCardinality(String),
        metric_name LowCardinality(String),
        bucket      DateTime,
        avg_value   AggregateFunction(avg, Float64),
        min_value   AggregateFunction(min, Float64),
        max_value   AggregateFunction(max, Float64),
        sample_count AggregateFunction(count)
    )
    ENGINE = AggregatingMergeTree
    PARTITION BY toYYYYMM(bucket)
    ORDER BY (tenant_slug, site_slug, device_key, metric_name, bucket)
    """,
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_agg_1m_mv TO telemetry_agg_1m AS
    SELECT
        tenant_slug, site_slug, device_key, metric_name,
        toStartOfMinute(ts) AS bucket,
        avgState(metric_value) AS avg_value,
        minState(metric_value) AS min_value,
        maxState(metric_value) AS max_value,
        countState() AS sample_count
    FROM telemetry
    GROUP BY tenant_slug, site_slug, device_key, metric_name, bucket
    """,
    """
    CREATE TABLE IF NOT EXISTS device_last_seen
    (
        tenant_slug LowCardinality(String),
        site_slug   LowCardinality(String),
        device_key  LowCardinality(String),
        last_seen   DateTime64(3, 'UTC'),
        status      LowCardinality(String) DEFAULT 'online',
        updated_at  DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(last_seen)
    ORDER BY (tenant_slug, site_slug, device_key)
    """,
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS device_last_seen_telemetry_mv TO device_last_seen AS
    SELECT
        tenant_slug, site_slug, device_key,
        ts AS last_seen,
        'online' AS status,
        now() AS updated_at
    FROM telemetry
    """,
    """
    CREATE MATERIALIZED VIEW IF NOT EXISTS device_last_seen_status_mv TO device_last_seen AS
    SELECT
        tenant_slug, site_slug, device_key,
        ts AS last_seen,
        status,
        now() AS updated_at
    FROM device_status
    """,
]


def _admin_ch_client():
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )


def _test_ch_client():
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
        database=settings.clickhouse_db,
    )


_pg_admin_url = settings.postgres_url.rsplit("/", 1)[0] + "/postgres"


def _ensure_test_pg_database() -> None:
    admin_engine = create_engine(_pg_admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": settings.postgres_db}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{settings.postgres_db}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _setup_test_databases():
    admin = _admin_ch_client()
    admin.command(f"CREATE DATABASE IF NOT EXISTS {settings.clickhouse_db}")
    test_client = _test_ch_client()
    for stmt in _CH_SCHEMA_STATEMENTS:
        test_client.command(stmt)

    _ensure_test_pg_database()
    pg_engine = create_engine(settings.postgres_url)
    PgBase.metadata.create_all(pg_engine)

    yield

    test_client.command(f"DROP DATABASE IF EXISTS {settings.clickhouse_db}")
    PgBase.metadata.drop_all(pg_engine)
    pg_engine.dispose()


@pytest.fixture()
async def ch_client():
    await telemetry_buffer.clear()
    await device_status_buffer.clear()
    client = _test_ch_client()
    client.command("TRUNCATE TABLE telemetry")
    client.command("TRUNCATE TABLE device_status")
    client.command("TRUNCATE TABLE telemetry_agg_1m")
    client.command("TRUNCATE TABLE device_last_seen")
    yield client


@pytest.fixture()
def pg_session():
    engine = create_engine(settings.postgres_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    tenant_slug_cache.clear()
    yield session
    session.query(Tenant).delete()
    session.commit()
    session.close()
    engine.dispose()


@pytest.fixture()
def tenant_a(pg_session):
    t = Tenant(id=uuid.uuid4(), slug="acme", is_active=True)
    pg_session.add(t)
    pg_session.commit()
    return t


@pytest.fixture()
def tenant_b(pg_session):
    t = Tenant(id=uuid.uuid4(), slug="beta", is_active=True)
    pg_session.add(t)
    pg_session.commit()
    return t


def make_token(tenant_id: uuid.UUID | None, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now.replace(year=now.year + 1),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture()
async def client(ch_client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
        yield c


@pytest.fixture()
async def ingest_client(ch_client):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
        headers={"X-Ingest-Secret": settings.ingest_secret},
    ) as c:
        yield c


@pytest.fixture()
def flush_buffers():
    async def _flush():
        await telemetry_buffer.flush()
        await device_status_buffer.flush()

    return _flush
