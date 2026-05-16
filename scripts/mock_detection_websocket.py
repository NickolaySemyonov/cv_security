# mock_detection_websocket.py
import asyncio
import json
import random
import time
import websockets
from datetime import datetime

CAMERA_ID = 14
WEBSOCKET_PORT = 8765

person1_trajectory = [
    [100, 100], [120, 110], [140, 120], [160, 130], [180, 140],
    [200, 150], [220, 160], [240, 170], [260, 180], [280, 190],
    [300, 200], [320, 210], [340, 220], [360, 230], [380, 240],
    [400, 250], [420, 260], [440, 270], [460, 280], [480, 290],
    [500, 300], [480, 310], [460, 320], [440, 330], [420, 340],
    [400, 350], [380, 360], [360, 370], [340, 380], [320, 390],
    [300, 400],
]

person2_trajectory = [
    [500, 100], [480, 110], [460, 120], [440, 130], [420, 140],
    [400, 150], [380, 160], [360, 170], [340, 180], [320, 190],
    [300, 200], [280, 210], [260, 220], [240, 230], [220, 240],
    [200, 250], [180, 260], [160, 270], [140, 280], [120, 290],
    [100, 300],
]

person3_trajectory = [
    [300, 80], [310, 90], [320, 100], [330, 110], [340, 120],
    [350, 130], [360, 140], [370, 150], [380, 160], [390, 170],
    [400, 180], [410, 190], [420, 200], [430, 210], [440, 220],
    [450, 230], [440, 240], [430, 250], [420, 260], [410, 270],
    [400, 280], [390, 290], [380, 300], [370, 310], [360, 320],
]

async def send_detections(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    print(f"Камера ID: {CAMERA_ID}")
    print("Отправляем пиксельные координаты (0-640, 0-480) - как у друга")
    
    index = 0
    
    try:
        while True:
            p1 = person1_trajectory[index % len(person1_trajectory)]
            p2 = person2_trajectory[index % len(person2_trajectory)]
            p3 = person3_trajectory[index % len(person3_trajectory)]
            
            p1 = [p1[0] + random.uniform(-5, 5), p1[1] + random.uniform(-5, 5)]
            p2 = [p2[0] + random.uniform(-5, 5), p2[1] + random.uniform(-5, 5)]
            p3 = [p3[0] + random.uniform(-5, 5), p3[1] + random.uniform(-5, 5)]
            
            message = {
                'camera_id': CAMERA_ID,
                'translated_points': [p1, p2, p3],
                'timestamp': time.time()
            }
            
            await websocket.send(json.dumps(message))
            print(f"📹 Камера {CAMERA_ID}: {len(message['translated_points'])} человек")
            print(f"   Точки: {[f'({p[0]:.1f}, {p[1]:.1f})' for p in [p1, p2, p3]]}")
            
            index += 1
            await asyncio.sleep(0.5)
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент отключился")

async def main():
    async with websockets.serve(send_detections, "localhost", WEBSOCKET_PORT):
        print("=" * 60)
        print(f"WebSocket сервер запущен на ws://localhost:{WEBSOCKET_PORT}")
        print(f"Камера ID: {CAMERA_ID}")
        print("Формат: пиксельные координаты (0-640, 0-480)")
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())