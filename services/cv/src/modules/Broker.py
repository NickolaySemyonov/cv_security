import threading
from dataclasses import dataclass
from enum import Enum

from pika.adapters.blocking_connection import BlockingConnection
from pika.connection import ConnectionParameters
from pika.credentials import PlainCredentials
from pika.spec import BasicProperties

from src.config.settings import Settings
from src.config.constants import CV_EXCHANGE_NAME


class ExchangeType(Enum):
    FANOUT = "fanout"
    TOPIC = "topic"
    DIRECT = "direct"


@dataclass
class ExchangeConfig:
    name: str
    type: ExchangeType
    durable: bool = True


class Broker:
    def __init__(self, settings: Settings):
        self.settings = settings
        #
        self.exchanges: dict[str, ExchangeConfig] = {
            CV_EXCHANGE_NAME: ExchangeConfig(CV_EXCHANGE_NAME, type=ExchangeType.FANOUT)
        }

        self.lock = threading.Lock()
        self.connection = None
        self.channel = None

    def connect(self) -> bool:
        with self.lock:
            if self.connection and not self.connection.is_closed:
                return True

            params = ConnectionParameters(
                host=self.settings.rabbitmq_host,
                port=self.settings.rabbitmq_port,
                credentials=PlainCredentials(
                    self.settings.rabbitmq_user,
                    self.settings.rabbitmq_password
                ),
                heartbeat=600,
                connection_attempts=3,
                retry_delay=5,
            )
            try:
                self.connection = BlockingConnection(params)
                self.channel = self.connection.channel()
                self._declare_exchanges()
                return True
            except Exception as e:
                print(f"[Broker] Connect failed: {e}")
                return False

    def close_connection(self):
        with self.lock:
            try:
                if self.connection and not self.connection.is_closed:
                    self.connection.close()
                    self.channel = None
            except Exception:
                pass

    def add_exchange_config(self, exchange_config: ExchangeConfig):
        if exchange_config:
            self.exchanges[exchange_config.name] = exchange_config

    def _declare_exchanges(self):
        if not self.channel:
            return
        for ex_key, config in self.exchanges.items():
            self.channel.exchange_declare(
                exchange=config.name,
                exchange_type=config.type.value,
                durable=config.durable
            )
            print(f"[Broker] Declared {config.name} ({config.type.value})")

    def publish(self, exchange_name: str, routing_key: str = "", body: bytes = b"") -> bool:
        if not self.connect():
            return False

        config = self.exchanges.get(exchange_name)
        if not config:
            print(f"[Broker] Unknown exchange: {exchange_name}")
            return False

        with self.lock:
            try:
                self.channel.basic_publish(
                    exchange=config.name,
                    routing_key=routing_key,
                    body=body,
                    properties=BasicProperties(delivery_mode=2)
                )
                return True
            except Exception as e:
                print(f"[Broker] Publish error: {e}")
                return False
