# mock_detection_websocket.py
import asyncio
import json
import random
import time
import websockets
from datetime import datetime

CAMERA_ID = 13
WEBSOCKET_PORT = 8765

# Относительные траектории (координаты 0-1, без привязки к конкретной зоне!)
person1_trajectory_rel = [
    [0.05, 0.05], [0.1, 0.08], [0.15, 0.1], [0.2, 0.12], [0.25, 0.15],
    [0.3, 0.18], [0.35, 0.2], [0.4, 0.22], [0.45, 0.25], [0.5, 0.28],
]

person2_trajectory_rel = [
    [0.7, 0.6], [0.65, 0.58], [0.6, 0.55], [0.55, 0.52], [0.5, 0.5],
    [0.45, 0.48], [0.4, 0.45], [0.35, 0.42], [0.3, 0.4], [0.25, 0.38],
]

person3_trajectory_rel = [
    [0.3, 0.8], [0.32, 0.78], [0.35, 0.75], [0.38, 0.72], [0.4, 0.7],
    [0.42, 0.68], [0.45, 0.65], [0.48, 0.62], [0.5, 0.6], [0.52, 0.58],
]

async def send_detections(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    print(f"Камера ID: {CAMERA_ID}")
    print("Отправляем относительные координаты (0-1)")
    index = 0
    
    try:
        while True:
            p1 = person1_trajectory_rel[index % len(person1_trajectory_rel)]
            p2 = person2_trajectory_rel[index % len(person2_trajectory_rel)]
            p3 = person3_trajectory_rel[index % len(person3_trajectory_rel)]
            
            message = {
                'camera_id': CAMERA_ID,
                'translated_points': [p1, p2, p3],  # Относительные координаты!
                'timestamp': time.time()
            }
            
            await websocket.send(json.dumps(message))
            print(f"📹 Камера {CAMERA_ID}: {len(message['translated_points'])} человек")
            
            index += 1
            await asyncio.sleep(0.5)
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент отключился")

async def main():
    async with websockets.serve(send_detections, "localhost", WEBSOCKET_PORT):
        print("=" * 60)
        print(f"WebSocket сервер запущен на ws://localhost:{WEBSOCKET_PORT}")
        print(f"Камера ID: {CAMERA_ID}")
        print("Формат: относительные координаты (0-1) внутри зоны видимости")
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())