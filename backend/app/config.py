import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "KisanGuard Portal"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "kisanguard-secret-jwt-key-hackspora-2026-pmkisan-auth"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    AADHAAR_SALT: str = "kisanguard_aadhaar_salt_secret_2026"
    DATABASE_URL: str = "sqlite:///./kisan_guard.db"
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MOCK_OTP: str = "123456"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")


settings = Settings()
