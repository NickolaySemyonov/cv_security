from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Broker settings
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_user: str
    rabbitmq_password: str

    # DB settings
    postgres_host: str
    postgres_port: int
    postgres_db: str
    postgres_user: str
    postgres_password: str

    # App settings
    camera_ids: list[int]
    model_path: str = "../yolo11n.pt"

    model_config = {"env_file": ".env"}
