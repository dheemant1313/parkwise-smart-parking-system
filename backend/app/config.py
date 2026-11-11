"""Configuration and environment variables for Parkwise Backend."""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    APP_NAME: str = "Parkwise Enterprise Smart Parking Platform"
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Database: PostgreSQL in production, SQLite fallback for local development
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./parkwise_v5.db")

    # Redis for distributed slot locking and pub/sub
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    SLOT_LOCK_TTL_SECONDS: int = 300

    # JWT & Cryptographic Signing Secrets (read from env in production)
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "parkwise-dev-only-jwt-secret-key-change-in-prod-98237492"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    QR_HMAC_SECRET: str = os.getenv(
        "QR_HMAC_SECRET", "parkwise-dev-only-qr-hmac-secret-key-change-in-prod-192837"
    )

    # Razorpay Payment Gateway (Test Mode defaults if env vars not provided)
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_parkwise_in_2026")
    RAZORPAY_KEY_SECRET: str = os.getenv(
        "RAZORPAY_KEY_SECRET", "parkwise-razorpay-sim-secret"
    )
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv(
        "RAZORPAY_WEBHOOK_SECRET", "parkwise-razorpay-webhook-secret"
    )
    PAYMENT_SIMULATION_MODE: bool = (
        os.getenv("PAYMENT_SIMULATION_MODE", "true").lower() == "true"
    )

    # AI Engine Settings
    AI_DYNAMIC_PRICING_ENABLED: bool = True
    AI_SURGE_MAX_MULTIPLIER: float = 2.25
    AI_ANPR_MIN_CONFIDENCE: float = 0.88

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
