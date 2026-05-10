import json
import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faststream.rabbit.fastapi import RabbitRouter
from faststream.rabbit import RabbitExchange, RabbitQueue, ExchangeType
from faststream.security import SASLPlaintext

from connection_manager import ConnectionManager

CV_EXCHANGE_NAME = "cv_exchange"
CV_QUEUE_NAME = "raw_detections_broadcast"
ALERTS_EXCHANGE_NAME = "alerts_exchange"
ALERTS_QUEUE_NAME = "alerts"

load_dotenv()
conn_mgr = ConnectionManager()

# region Rabbit Router
rabbit_router = RabbitRouter(
    host=os.getenv("RABBITMQ_HOST"),
    port=int(os.getenv("RABBITMQ_PORT")),
    security=SASLPlaintext(
        username=os.getenv("RABBITMQ_USER"),
        password=os.getenv("RABBITMQ_PASSWORD")
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
        "main:app",
        host=os.getenv("UVICORN_HOST"),
        port=int(os.getenv("UVICORN_PORT")),
        reload=True,
        log_level="info",
    )
