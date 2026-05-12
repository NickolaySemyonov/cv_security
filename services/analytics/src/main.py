import asyncio
from typing import Annotated

from faststream import FastStream, ContextRepo, Context
from faststream.rabbit import RabbitBroker, RabbitQueue, RabbitExchange, ExchangeType
from faststream.security import SASLPlaintext

from src.config.constants import CV_QUEUE_NAME, CV_EXCHANGE_NAME, ALERTS_EXCHANGE_NAME
from src.detection_analyzer import DetectionAnalyzer

from src.config.settings import Settings
from src.models import DetectionMessage, DetectionAlert

settings = Settings()

broker = RabbitBroker(
    host=settings.rabbitmq_host,
    port=settings.rabbitmq_port,
    security=SASLPlaintext(
        username=settings.rabbitmq_user,
        password=settings.rabbitmq_password
    ))


@broker.subscriber(
    RabbitQueue(name=CV_QUEUE_NAME, durable=True),
    RabbitExchange(name=CV_EXCHANGE_NAME, type=ExchangeType.FANOUT, durable=True)
)
async def analyze_detection_message(
        detection_msg: DetectionMessage,
        detection_analyzer: Annotated[DetectionAnalyzer, Context()]):
    result: DetectionAlert = detection_analyzer.analyze(detection_msg)
    if result:
        await broker.publish(
            result.model_dump(),
            exchange=RabbitExchange(name=ALERTS_EXCHANGE_NAME, type=ExchangeType.TOPIC, durable=True),
            routing_key=result.type
        )


app = FastStream(broker)


@app.on_startup
async def init_context(context: ContextRepo):
    context.set_global("settings", settings)
    context.set_global("detection_analyzer", DetectionAnalyzer())


if __name__ == "__main__":
    asyncio.run(app.run())
