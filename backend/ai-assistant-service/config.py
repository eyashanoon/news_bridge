from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    app_name: str = "AI Assistant Service"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 9000

    # Backend API
    backend_base_url: str = "http://localhost:8080/api"
    backend_token: Optional[str] = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMTEiLCJ0eXBlIjoiUkVHSVNURVJFRCIsInJvbGVzIjpbIlJFQUNUX1BPU1QiLCJSRVBPUlRfUE9TVCIsIk1BTkFHRV9PV05fUFJPRklMRSIsIkNSRUFURV9FRElUT1JfUkVRVUVTVCIsIlJFQURfQVJUSUNMRSIsIkxFQVZFX0NPTU1FTlQiXSwiaWF0IjoxNzgwODU5NDQxLCJleHAiOjE3ODA5NDU4NDEsImVtYWlsIjoiQUlAdC50IiwiY3JlYXRlZEF0IjoxNzgwODU5NDI3MDExfQ.Z2e9YOm64wtdnbtYnUoqHmTTb3o4nxI85Pf6FVATjbzqxC2H0biLYMEUzSmYtstA0bNuEYWmWrvdgUwoi0ZaGw"

    # Ollama / LLM
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "llama3.2:3b"
    embedder_model: str = "nomic-embed-text"
    llm_temperature: float = 0.3
    llm_temperature_brief: float = 0.4
    llm_temperature_translate: float = 0.0

    # Vector store
    vector_dim: int = 768
    vector_store_path: str = "data/faiss.index"
    meta_store_path: str = "data/meta.json"
    chunk_size: int = 250
    chunk_overlap: int = 50

    # Retrieval
    default_top_k: int = 5
    fallback_top_k: int = 10

    # Scheduler
    auto_ingest_interval_minutes: int = 15

    model_config = {"env_prefix": "AI_ASSISTANT_", "case_sensitive": False}


settings = Settings()