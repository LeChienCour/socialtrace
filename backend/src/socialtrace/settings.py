from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SOCIALTRACE_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "socialtrace"
    postgres_user: str = "socialtrace"
    postgres_password: str = "socialtrace"

    # Static-token auth placeholder. No auth endpoints exist yet (phase 1+),
    # but the field lives here from commit 1 so nothing needs restructuring later.
    api_token: str | None = None

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
