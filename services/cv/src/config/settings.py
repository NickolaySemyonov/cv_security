from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_user: str
    rabbitmq_password: str

    model_config = {"env_file": ".env"}
