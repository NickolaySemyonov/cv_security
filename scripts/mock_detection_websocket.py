# D:\DIPLOM\cv_security\scripts\mock_detection_websocket.py
import asyncio
import json
import random
import time
import websockets
from datetime import datetime

CAMERA_ID = 12
WEBSOCKET_PORT = 8765

# Зона видимости камеры на карте (visible_zone)
# Левый верхний, правый верхний, правый нижний, левый нижний
CAMERA_ZONE = {
    "min_x": 299,
    "max_x": 450,
    "min_y": 49,
    "max_y": 199
}

# Точки в координатах КАРТЫ (сразу в пикселях SVG)
# Движение внутри зоны видимости
trajectory_points = [
    [310, 60], [320, 65], [330, 70], [340, 75], [350, 80],
    [360, 85], [370, 90], [380, 95], [390, 100], [400, 105],
    [410, 110], [420, 115], [430, 120], [440, 125], [440, 130],
    [430, 135], [420, 140], [410, 145], [400, 150], [390, 155],
    [380, 160], [370, 165], [360, 170], [350, 175], [340, 180],
    [330, 185], [320, 190], [310, 195], [310, 190], [320, 185],
    [330, 180], [340, 175], [350, 170], [360, 165], [370, 160],
    [380, 155], [390, 150], [400, 145], [410, 140], [420, 135],
    [430, 130], [440, 125], [440, 120], [430, 115], [420, 110],
    [410, 105], [400, 100], [390, 95], [380, 90], [370, 85],
    [360, 80], [350, 75], [340, 70], [330, 65], [320, 60],
]

async def send_detections(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    point_index = 0
    
    try:
        while True:
            # Берём точку из траектории (уже в координатах карты)
            x, y = trajectory_points[point_index % len(trajectory_points)]
            
            # Добавляем небольшой шум
            x += random.uniform(-3, 3)
            y += random.uniform(-3, 3)
            
            # Ограничиваем в пределах зоны
            x = max(CAMERA_ZONE["min_x"], min(CAMERA_ZONE["max_x"], x))
            y = max(CAMERA_ZONE["min_y"], min(CAMERA_ZONE["max_y"], y))
            
            message = {
                'camera_id': CAMERA_ID,
                'translated_points': [[round(x, 2), round(y, 2)]],
                'timestamp': time.time()
            }
            
            await websocket.send(json.dumps(message))
            print(f"📹 Камера {CAMERA_ID}: точка ({round(x, 2)}, {round(y, 2)})")
            
            point_index += 1
            await asyncio.sleep(0.3)
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент отключился")

async def main():
    async with websockets.serve(send_detections, "localhost", WEBSOCKET_PORT):
        print("=" * 60)
        print(f"WebSocket сервер запущен на ws://localhost:{WEBSOCKET_PORT}")
        print(f"Камера ID: {CAMERA_ID}")
        print(f"Зона видимости на карте: X[{CAMERA_ZONE['min_x']}-{CAMERA_ZONE['max_x']}], Y[{CAMERA_ZONE['min_y']}-{CAMERA_ZONE['max_y']}]")
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())