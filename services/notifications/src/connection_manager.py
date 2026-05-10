import asyncio
import json
from typing import Set

from fastapi import WebSocket


class ConnectionManager:
    """Websocket connection manager for message broadcasting"""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        print(f"Client connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)
        print(f"Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send message to all connected clients"""
        disconnected = set()

        async with self._lock:
            connections = self.active_connections.copy()

        for websocket in connections:
            try:
                await websocket.send_text(
                    json.dumps({
                        "source": "rabbitmq",
                        "data": message
                    })
                )
            except Exception:
                disconnected.add(websocket)

        # remove a set of inactive connections
        if disconnected:
            async with self._lock:
                self.active_connections -= disconnected
