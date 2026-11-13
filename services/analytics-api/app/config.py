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
    # Spool disk (B1): kalau insert ke ClickHouse gagal, baris ditulis ke disk
    # dan di-replay saat pulih — bukan dibuang diam-diam.
    ingest_spool_dir: str = "/var/lib/iiot/spool"
    ingest_spool_max_mb: int = 512
    ingest_backoff_max_seconds: float = 60.0

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

    # User External MySQL Sink
    mysql_sink_enabled: bool = False
    mysql_sink_host: str = "127.0.0.1"
    mysql_sink_port: int = 3306
    mysql_sink_db: str = "iiot_telemetry"
    mysql_sink_user: str = "root"
    mysql_sink_password: str = ""
    mysql_sink_table: str = "telemetry"
    mysql_sink_tenant_slug: str = ""
    mysql_sink_use_ssl: bool = True
    mysql_sink_ssl_ca: str | None = None
    mysql_sink_ssl_verify_cert: bool = False
    mysql_sink_batch_size: int = 500
    mysql_sink_flush_interval_seconds: float = 2.0
    mysql_sink_max_buffered_rows: int = 100_000

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
