from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Aspendora Remote Console"

    # PostgreSQL (console database — all device data lives here)
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@db:5432/aspendora_console"
    )

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://rd.aspendora.com",
    ]

    # SMTP / Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Aspendora Remote Console"
    SMTP_USE_TLS: bool = True
    SMTP_ENABLED: bool = False  # must be explicitly enabled

    # Microsoft Entra ID SSO
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_TENANT_ID: str = ""
    ENTRA_REDIRECT_URI: str = "https://rd.aspendora.com/api/auth/sso/callback"
    ENTRA_ENABLED: bool = False  # must be explicitly enabled

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
