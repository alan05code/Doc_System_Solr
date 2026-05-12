from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "Sistema Documentale"
    debug: bool = False

    # MongoDB
    mongo_url: str = "mongodb://admin:secret@localhost:27017"
    mongo_db: str = "docmanager"

    # Solr
    solr_url: str = "http://localhost:8983/solr/documents"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    # Ollama
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "schien/qwen3.5-lite:latest"
    ollama_timeout: int = 30

    # File storage
    upload_dir: str = "uploads"
    max_file_size_mb: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
