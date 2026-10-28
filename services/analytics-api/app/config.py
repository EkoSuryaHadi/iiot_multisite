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

    # Mitratel External Open REST API (RKS Pasal 2.3.3.c butir 5)
    mitratel_api_key: str = "mitratel-sps-api-key-secret-2026"
    mitratel_default_tenant_slug: str = "mitratel"

    # Oneflux Northbound MQTT Bridge (RKS Pasal 2.3.3.c butir 1)
    oneflux_mqtt_enabled: bool = False
    oneflux_mqtt_host: str = "mqtt.oneflux.mitratel.co.id"
    oneflux_mqtt_port: int = 8883
    oneflux_mqtt_username: str | None = None
    oneflux_mqtt_password: str | None = None
    oneflux_mqtt_use_tls: bool = False
    oneflux_mqtt_client_id: str = "iiot-gtaas-northbound-bridge"
    oneflux_mqtt_topic_prefix: str = "mitratel/gtaas"
    oneflux_publish_interval_seconds: float = 300.0

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
