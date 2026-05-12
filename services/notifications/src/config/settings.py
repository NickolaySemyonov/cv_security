from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_user: str
    rabbitmq_password: str

    uvicorn_host: str
    uvicorn_port: int = 8000
    uvicorn_reload: bool = True
    uvicorn_log_level: str = "info"

    model_config = {"env_file": ".env"}
