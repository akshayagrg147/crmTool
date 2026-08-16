from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://districall:districall@localhost:5432/districall"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    impersonation_token_expire_minutes: int = 30
    cors_origins: str = "http://localhost:5173"

    # Encrypts third-party integration credentials at rest. Falls back to
    # jwt_secret so dev works out of the box; set it explicitly in production.
    integration_encryption_key: str = ""
    # Public base URL used to build the webhook address shown in the UI.
    public_base_url: str = "http://localhost:8000"
    # How often the background poller pulls from pull-based providers.
    integration_poll_interval_seconds: int = 300

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
