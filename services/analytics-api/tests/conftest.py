import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import clickhouse_connect
import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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

import app.clickhouse_client as ch_client_mod  # noqa: E402
from app.buffer import device_status_buffer, telemetry_buffer  # noqa: E402
from app.cache import tenant_slug_cache  # noqa: E402
from app.config import settings  # noqa: E402
from app.database_pg import PgBase, get_pg_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models_pg import Tenant  # noqa: E402

_CH_INIT_DIR = Path(__file__).resolve().parents[2] / "clickhouse" / "init"


def _load_clickhouse_init_statements() -> list[str]:
    statements: list[str] = []
    if not _CH_INIT_DIR.exists():
        return statements
    for sql_file in sorted(_CH_INIT_DIR.glob("*.sql")):
        if sql_file.name == "001-init-db.sql":
            continue
        raw = sql_file.read_text(encoding="utf-8")
        cleaned_lines = [
            line for line in raw.splitlines() if not line.strip().startswith("--")
        ]
        cleaned_sql = "\n".join(cleaned_lines)
        for stmt in cleaned_sql.split(";"):
            stmt_str = stmt.strip()
            if not stmt_str or stmt_str.upper().startswith("USE "):
                continue
            statements.append(stmt_str)
    return statements


@dataclass
class _FakeQueryResult:
    result_rows: list[tuple]


class _InMemoryClickHouseClient:
    """Fallback ClickHouse client for local testing when ClickHouse container is unreachable."""

    def __init__(self) -> None:
        self.tables: dict[str, str] = {}
        self.views: dict[str, str] = {}
        self.data: dict[str, list[tuple]] = {}

    def command(self, cmd: str):
        cmd_clean = " ".join(cmd.strip().split())
        m_create_table = re.match(
            r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)",
            cmd_clean,
            re.IGNORECASE,
        )
        if m_create_table:
            tbl = m_create_table.group(1).split(".")[-1]
            self.tables[tbl] = cmd.strip()
            self.data.setdefault(tbl, [])
            return ""

        m_create_mv = re.match(
            r"CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)",
            cmd_clean,
            re.IGNORECASE,
        )
        if m_create_mv:
            mv = m_create_mv.group(1).split(".")[-1]
            self.views[mv] = cmd.strip()
            return ""

        m_show_tables = re.match(
            r"SHOW\s+TABLES(?:\s+LIKE\s+'([^']+)')?",
            cmd_clean,
            re.IGNORECASE,
        )
        if m_show_tables:
            pattern = m_show_tables.group(1)
            all_names = list(self.tables.keys()) + list(self.views.keys())
            if not pattern:
                return "\n".join(sorted(all_names))
            regex = "^" + re.escape(pattern).replace("%", ".*").replace("_", ".") + "$"
            matched = [name for name in all_names if re.match(regex, name)]
            return "\n".join(sorted(matched))

        m_show_create = re.match(
            r"SHOW\s+CREATE\s+TABLE\s+([a-zA-Z0-9_.]+)",
            cmd_clean,
            re.IGNORECASE,
        )
        if m_show_create:
            tbl = m_show_create.group(1).split(".")[-1]
            return self.tables.get(tbl) or self.views.get(tbl, "")

        m_truncate = re.match(
            r"TRUNCATE\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_.]+)",
            cmd_clean,
            re.IGNORECASE,
        )
        if m_truncate:
            tbl = m_truncate.group(1).split(".")[-1]
            self.data[tbl] = []
            return ""

        return ""

    def insert(self, table: str, data: list[tuple], column_names: list[str] | None = None):
        tbl = table.split(".")[-1]
        self.data.setdefault(tbl, []).extend(data)

    def query(self, query_str: str, parameters: dict[str, Any] | None = None) -> _FakeQueryResult:
        params = parameters or {}
        q_upper = " ".join(query_str.upper().split())
        rows = self.data.get("telemetry", [])

        # Filter by tenant_slug, site_slug, device_key, metric_name, start, end
        filtered = []
        for r in rows:
            # telemetry row tuple: (tenant_slug, site_slug, device_key, metric_name, metric_value, ts, raw_payload)
            t_slug, s_slug, d_key, m_name, m_val, ts_val = r[0], r[1], r[2], r[3], float(r[4]), r[5]
            if "tenant_slug" in params and t_slug != params["tenant_slug"]:
                continue
            if "site_slug" in params and s_slug != params["site_slug"]:
                continue
            if "device_key" in params and d_key != params["device_key"]:
                continue
            if "metric_name" in params and m_name != params["metric_name"]:
                continue
            if "start" in params and ts_val < params["start"]:
                continue
            if "end" in params and ts_val > params["end"]:
                continue
            filtered.append(r)

        if "ARGMAX(METRIC_VALUE, TS)" in q_upper and "GROUP BY METRIC_NAME" in q_upper:
            by_metric: dict[str, list[tuple[datetime, float]]] = {}
            for r in filtered:
                by_metric.setdefault(r[3], []).append((r[5], float(r[4])))
            out = []
            for m_name in sorted(by_metric.keys()):
                pts = by_metric[m_name]
                latest_val = max(pts, key=lambda x: x[0])[1]
                avg_val = sum(x[1] for x in pts) / len(pts)
                out.append((m_name, latest_val, avg_val))
            return _FakeQueryResult(out)

        if "AVG(METRIC_VALUE)" in q_upper and "GROUP BY METRIC_NAME" in q_upper:
            by_metric_vals: dict[str, list[float]] = {}
            for r in filtered:
                by_metric_vals.setdefault(r[3], []).append(float(r[4]))
            out = []
            for m_name in sorted(by_metric_vals.keys()):
                vals = by_metric_vals[m_name]
                out.append((m_name, sum(vals) / len(vals), min(vals), max(vals), len(vals)))
            return _FakeQueryResult(out)

        return _FakeQueryResult(filtered)


_FALLBACK_CH_CLIENT: _InMemoryClickHouseClient | None = None
_ACTIVE_PG_ENGINE = None


def _admin_ch_client():
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
        connect_timeout=1,
    )


def _test_ch_client():
    global _FALLBACK_CH_CLIENT
    if _FALLBACK_CH_CLIENT is not None:
        return _FALLBACK_CH_CLIENT
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
        database=settings.clickhouse_db,
        connect_timeout=1,
    )


_pg_admin_url = settings.postgres_url.rsplit("/", 1)[0] + "/postgres"


def _ensure_test_pg_database() -> None:
    admin_engine = create_engine(
        _pg_admin_url,
        isolation_level="AUTOCOMMIT",
        connect_args={"connect_timeout": 1},
    )
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": settings.postgres_db}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{settings.postgres_db}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _setup_test_databases():
    global _FALLBACK_CH_CLIENT, _ACTIVE_PG_ENGINE
    statements = _load_clickhouse_init_statements()
    try:
        admin = _admin_ch_client()
        admin.command(f"CREATE DATABASE IF NOT EXISTS {settings.clickhouse_db}")
        test_client = _test_ch_client()
    except Exception:
        _FALLBACK_CH_CLIENT = _InMemoryClickHouseClient()
        test_client = _FALLBACK_CH_CLIENT
        ch_client_mod.set_override_client(_FALLBACK_CH_CLIENT)

    for stmt in statements:
        if stmt.strip().upper().startswith("INSERT INTO"):
            continue
        test_client.command(stmt)

    try:
        _ensure_test_pg_database()
        pg_engine = create_engine(settings.postgres_url, connect_args={"connect_timeout": 1})
        with pg_engine.connect():
            pass
    except Exception:
        pg_engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    _ACTIVE_PG_ENGINE = pg_engine
    PgBase.metadata.create_all(pg_engine)

    def _override_get_pg_db():
        SessionLocal = sessionmaker(bind=_ACTIVE_PG_ENGINE)
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_pg_db] = _override_get_pg_db

    yield

    app.dependency_overrides.pop(get_pg_db, None)
    if _FALLBACK_CH_CLIENT is None:
        test_client.command(f"DROP DATABASE IF EXISTS {settings.clickhouse_db}")
    PgBase.metadata.drop_all(pg_engine)
    pg_engine.dispose()


@pytest.fixture()
async def ch_client():
    await telemetry_buffer.clear()
    await device_status_buffer.clear()
    client = _test_ch_client()
    for tbl in ("telemetry", "device_status", "telemetry_agg_1m", "device_last_seen", "sps_daily_energy"):
        if _FALLBACK_CH_CLIENT is not None and tbl not in _FALLBACK_CH_CLIENT.tables:
            continue
        try:
            client.command(f"TRUNCATE TABLE {tbl}")
        except Exception:
            pass
    yield client


@pytest.fixture()
def clickhouse_client(ch_client):
    return ch_client


@pytest.fixture()
def pg_session():
    engine = _ACTIVE_PG_ENGINE or create_engine(settings.postgres_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    tenant_slug_cache.clear()
    yield session
    session.query(Tenant).delete()
    session.commit()
    session.close()


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
