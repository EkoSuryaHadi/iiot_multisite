from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

pg_engine = create_engine(settings.postgres_url, pool_pre_ping=True)
PgSessionLocal = sessionmaker(bind=pg_engine, autoflush=False, autocommit=False)


class PgBase(DeclarativeBase):
    pass


def get_pg_db() -> Session:
    db = PgSessionLocal()
    try:
        yield db
    finally:
        db.close()
