import json

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faststream.rabbit import RabbitExchange, RabbitQueue, ExchangeType
from faststream.rabbit.fastapi import RabbitRouter
from faststream.security import SASLPlaintext

from src.config.constants import CV_QUEUE_NAME, CV_EXCHANGE_NAME, ALERTS_QUEUE_NAME, ALERTS_EXCHANGE_NAME
from src.config.settings import Settings
from src.connection_manager import ConnectionManager

settings = Settings()
conn_mgr = ConnectionManager()

# region Rabbit Router
rabbit_router = RabbitRouter(
    host=settings.rabbitmq_host,
    port=settings.rabbitmq_port,
    security=SASLPlaintext(
        username=settings.rabbitmq_user,
        password=settings.rabbitmq_password
    )
)


@rabbit_router.subscriber(
    RabbitQueue(CV_QUEUE_NAME, durable=True),
    RabbitExchange(CV_EXCHANGE_NAME, type=ExchangeType.FANOUT, durable=True)
)
async def handle_detection(message: dict):
    await conn_mgr.broadcast(message)


@rabbit_router.subscriber(
    RabbitQueue(ALERTS_QUEUE_NAME, durable=True),
    RabbitExchange(ALERTS_EXCHANGE_NAME, type=ExchangeType.TOPIC, durable=True)
)
async def handle_alert(message: dict):
    await conn_mgr.broadcast(message)


# endregion

# region FASTAPI APP
app = FastAPI()
app.include_router(rabbit_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await conn_mgr.connect(websocket)
    try:
        while True:
            # Просто держим соединение открытым и слушаем "пинг" от клиента
            await websocket.receive_text()
    except WebSocketDisconnect:
        await conn_mgr.disconnect(websocket)


@app.get("/stats")
def stats_endpoint():
    return json.dumps({"total_connections": conn_mgr.connection_count})


# endregion


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.uvicorn_host,
        port=settings.uvicorn_port,
        reload=settings.uvicorn_reload,
        log_level=settings.uvicorn_log_level,
    )
