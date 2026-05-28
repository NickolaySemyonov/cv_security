import asyncio
import json
import random
import math
import websockets
from datetime import datetime

CAMERA_ID = 46
WEBSOCKET_PORT = 8765

# Нормализованные координаты (0-1) для движения людей
# Эти точки будут поворачиваться и масштабироваться в соответствии с углом камеры и frame_shape

person1_trajectory = [
    [0.2, 0.2], [0.22, 0.21], [0.24, 0.22], [0.26, 0.23], [0.28, 0.24],
    [0.3, 0.25], [0.32, 0.26], [0.34, 0.27], [0.36, 0.28], [0.38, 0.29],
    [0.4, 0.3], [0.42, 0.31], [0.44, 0.32], [0.46, 0.33], [0.48, 0.34],
    [0.5, 0.35], [0.48, 0.36], [0.46, 0.37], [0.44, 0.38], [0.42, 0.39],
    [0.4, 0.4],
]

person2_trajectory = [
    [0.7, 0.2], [0.68, 0.21], [0.66, 0.22], [0.64, 0.23], [0.62, 0.24],
    [0.6, 0.25], [0.58, 0.26], [0.56, 0.27], [0.54, 0.28], [0.52, 0.29],
    [0.5, 0.3], [0.48, 0.31], [0.46, 0.32], [0.44, 0.33], [0.42, 0.34],
    [0.4, 0.35],
]

person3_trajectory = [
    [0.45, 0.15], [0.46, 0.16], [0.47, 0.17], [0.48, 0.18], [0.49, 0.19],
    [0.5, 0.2], [0.51, 0.21], [0.52, 0.22], [0.53, 0.23], [0.54, 0.24],
    [0.55, 0.25], [0.54, 0.26], [0.53, 0.27], [0.52, 0.28], [0.51, 0.29],
    [0.5, 0.3], [0.49, 0.31], [0.48, 0.32], [0.47, 0.33], [0.46, 0.34],
    [0.45, 0.35],
]

def generate_random_points(base_points):
    """Генерирует точки с небольшим случайным偏移"""
    return [
        [p[0] + random.uniform(-0.02, 0.02), 
         p[1] + random.uniform(-0.02, 0.02)] 
        for p in base_points
    ]

async def send_detections(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    print(f"Камера ID: {CAMERA_ID}")
    print("Формат: нормализованные координаты (0-1)")
    
    index = 0
    
    try:
        while True:
            p1 = person1_trajectory[index % len(person1_trajectory)]
            p2 = person2_trajectory[index % len(person2_trajectory)]
            p3 = person3_trajectory[index % len(person3_trajectory)]
            
            # Добавляем случайное смещение для более естественного движения
            points = generate_random_points([p1, p2, p3])
            
            message = {
                'camera_id': CAMERA_ID,
                'translated_points': points,
                'timestamp': time.time()
            }
            
            # Отправляем в формате DetectionMessage
            full_message = {
                'type': 'detection',
                'message': message
            }
            
            await websocket.send(json.dumps(full_message))
            print(f"📹 Камера {CAMERA_ID}: {len(points)} человек")
            print(f"   Точки (нормализованные): {[f'({p[0]:.2f}, {p[1]:.2f})' for p in points]}")
            
            index += 1
            await asyncio.sleep(0.5)
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент отключился")

async def main():
    async with websockets.serve(send_detections, "localhost", WEBSOCKET_PORT):
        print("=" * 60)
        print(f"WebSocket сервер запущен на ws://localhost:{WEBSOCKET_PORT}")
        print(f"Камера ID: {CAMERA_ID}")
        print("Формат: нормализованные координаты (0-1)")
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    import time
    asyncio.run(main())