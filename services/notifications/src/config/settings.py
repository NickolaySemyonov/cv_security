from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=False
    )
    # Broker settings
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_user: str
    rabbitmq_password: str

    # Uvicorn settings
    uvicorn_host: str
    uvicorn_port: int = 8000
    uvicorn_reload: bool = True
    uvicorn_log_level: str = "info"
