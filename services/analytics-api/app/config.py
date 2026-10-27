from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    clickhouse_host: str = "clickhouse"
    clickhouse_port: int = 8123
    clickhouse_db: str = "iiot"
    clickhouse_user: str = "iiot"
    clickhouse_password: str = "iiot"

    # Buffering ingest: flush saat salah satu kondisi tercapai (batch penuh / interval lewat).
    ingest_batch_size: int = 500
    ingest_flush_interval_seconds: float = 2.0
    ingest_secret: str = "change_me_ingest_secret"
    ingest_max_buffered_rows: int = 100_000

    # MySQL Client Sync (Port 3306)
    mysql_host: str = "mysql"
    mysql_port: int = 3306
    mysql_db: str = "iiot"
    mysql_user: str = "andreas.nugroho@gaungnusa.com"
    mysql_password: str = "Password123456"
    mysql_enabled: bool = True

    # Postgres (read-only) - dipakai untuk resolusi tenant_id (JWT) -> tenant_slug (ClickHouse).
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "iiot"
    postgres_user: str = "iiot"
    postgres_password: str = "iiot"

    # JWT - berbagi secret yang sama dengan device-mgmt.
    jwt_secret: str = "change_me_jwt_secret"
    jwt_algorithm: str = "HS256"

    # Cache tenant_id -> tenant_slug, agar tidak query Postgres di setiap request.
    tenant_cache_ttl_seconds: int = 60

    # Query & pagination.
    default_page_size: int = 100
    max_page_size: int = 1000

    # Rate limit (per klien, lihat app/main.py).
    rate_limit: str = "120/minute"

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
