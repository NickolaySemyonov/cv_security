# mock_detection_websocket.py
import asyncio
import json
import random
import time
import websockets
from datetime import datetime

CAMERA_ID = 12
WEBSOCKET_PORT = 8765

# Траектории для разных людей
person1_trajectory = [
    [310, 60], [320, 65], [330, 70], [340, 75], [350, 80],
    [360, 85], [370, 90], [380, 95], [390, 100], [400, 105],
]

person2_trajectory = [
    [400, 150], [390, 145], [380, 140], [370, 135], [360, 130],
    [350, 125], [340, 120], [330, 115], [320, 110], [310, 105],
]

person3_trajectory = [
    [350, 180], [355, 175], [360, 170], [365, 165], [370, 160],
    [375, 155], [380, 150], [385, 145], [390, 140], [395, 135],
]

async def send_detections(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    index = 0
    
    try:
        while True:
            # Берём точки для каждого человека
            p1 = person1_trajectory[index % len(person1_trajectory)]
            p2 = person2_trajectory[index % len(person2_trajectory)]
            p3 = person3_trajectory[index % len(person3_trajectory)]
            
            # Добавляем шум
            p1 = [p1[0] + random.uniform(-3, 3), p1[1] + random.uniform(-3, 3)]
            p2 = [p2[0] + random.uniform(-3, 3), p2[1] + random.uniform(-3, 3)]
            p3 = [p3[0] + random.uniform(-3, 3), p3[1] + random.uniform(-3, 3)]
            
            message = {
                'camera_id': CAMERA_ID,
                'translated_points': [p1, p2, p3],  # ТРИ человека!
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
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())