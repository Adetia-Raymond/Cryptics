# app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Cryptics API"

    DB_URL: str = os.getenv("DB_URL")
    REDIS_URL: str = os.getenv("REDIS_URL")

    JWT_SECRET: str = os.getenv("JWT_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))

    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    CRYPTOPANIC_API_KEY: str = os.getenv("CRYPTOPANIC_API_KEY", "")
    # Comma-separated list of allowed origins for CORS (use full origin, e.g. http://localhost:3000)
    # Default list includes common local dev origins (web dev servers and Expo web)
    BACKEND_CORS_ORIGINS: list = [o.strip() for o in os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",") if o.strip()]
    # If true, cookies will be set with Secure=True
    PRODUCTION: bool = os.getenv("PRODUCTION", "false").lower() in ("1", "true", "yes")

settings = Settings()
