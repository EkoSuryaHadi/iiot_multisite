from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "iiot"
    postgres_user: str = "iiot"
    postgres_password: str = "iiot"

    # TTL cache agar tidak membebani Postgres di setiap publish/subscribe.
    cache_ttl_seconds: int = 30
    cache_max_size: int = 10_000

    # Akun service internal (superuser) untuk Rule Engine / service backend lain.
    internal_service_username: str = "internal-service"
    internal_service_password: str = "change_me_internal_service_password"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
