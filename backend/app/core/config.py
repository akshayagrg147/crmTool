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
    # Optional in-network WhatsApp Web bridge. The bridge is never exposed publicly.
    whatsapp_bridge_url: str = ""
    whatsapp_bridge_token: str = ""
    whatsapp_bridge_timeout_seconds: int = 15
    backup_dir: str = "./data/backups"
    attachment_dir: str = "./data/attachments"
    max_attachment_size_bytes: int = 10 * 1024 * 1024

    # Organization logos are kept in a private S3 bucket and served through
    # the public branding proxy route. The AWS SDK uses the instance role (or
    # standard AWS environment credentials).
    s3_bucket: str = ""
    s3_region: str = ""
    s3_endpoint_url: str = ""
    max_logo_size_bytes: int = 5 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
