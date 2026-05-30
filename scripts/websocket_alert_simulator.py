import asyncio
import json
import random
import time
import websockets
from datetime import datetime

WEBSOCKET_PORT = 8766

ZONES = [
    {"id": 11, "name": "Красная зона 1"}
]

CAMERAS = [46, 47, 48]

ALERT_MESSAGES = [
    "Обнаружен человек в запрещённой зоне",
    "Нарушение периметра",
    "Несанкционированное проникновение",
    "Обнаружено движение в охраняемой зоне",
    "Нарушение границы зоны",
    "Подозрительная активность",
]

async def send_alerts(websocket):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент уведомлений подключился")
    
    alert_index = 0
    
    try:
        while True:
            await asyncio.sleep(random.uniform(5, 15))
            
            zone = random.choice(ZONES)
            camera_id = random.choice(CAMERAS)
            alert_text = random.choice(ALERT_MESSAGES)
            
            alert_message = {
                'info': f"{alert_text} (зона {zone['name']})",
                'camera_id': camera_id,
                'zone_id': zone['id'],
                'timestamp': time.time()
            }
            
            full_message = {
                'type': 'alert',
                'message': alert_message
            }
            
            await websocket.send(json.dumps(full_message))
            print(f"🔴 УВЕДОМЛЕНИЕ: {alert_message['info']}")
            print(f"   Камера: {camera_id}, Зона: {zone['id']}")
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент уведомлений отключился")

async def main():
    async with websockets.serve(send_alerts, "localhost", WEBSOCKET_PORT):
        print("=" * 60)
        print(f"WebSocket сервер уведомлений запущен на ws://localhost:{WEBSOCKET_PORT}")
        print("Тип сообщений: alert")
        print("=" * 60)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())