import asyncio
import json
import random
import time
import websockets
from datetime import datetime
from typing import Set

WEBSOCKET_PORT = 8765

# Данные для генерации детекций
ZONES = [
    {"id": 11, "name": "Красная зона 1"},
    {"id": 12, "name": "Красная зона 2"},
]

CAMERAS = [
    {"id": 55, "zone_ids": [11], "zone_bounds": {"minX": 100, "maxX": 300, "minY": 100, "maxY": 300}},
    {"id": 66, "zone_ids": [12], "zone_bounds": {"minX": 400, "maxX": 600, "minY": 100, "maxY": 300}},
]

ALERT_MESSAGES = [
    "Обнаружен человек в запрещённой зоне",
    "Нарушение периметра",
    "Несанкционированное проникновение",
    "Обнаружено движение в охраняемой зоне",
    "Нарушение границы зоны",
    "Подозрительная активность",
]

# Храним активные подключения
connected_clients: Set[websockets.WebSocketServerProtocol] = set()

def generate_detection_points(camera_id: int, zone_bounds: dict):
    """Генерирует случайные точки детекции в пределах зоны камеры"""
    num_points = random.randint(1, 3)
    points = []
    
    for _ in range(num_points):
        # Генерируем относительные координаты (0-1)
        rel_x = random.uniform(0.2, 0.8)
        rel_y = random.uniform(0.2, 0.8)
        points.append([rel_x, rel_y])
    
    return {
        "camera_id": camera_id,
        "translated_points": points,
        "timestamp": time.time()
    }

async def broadcast(message: dict):
    """Отправляет сообщение всем подключенным клиентам"""
    if connected_clients:
        message_json = json.dumps(message)
        await asyncio.gather(*[client.send(message_json) for client in connected_clients], return_exceptions=True)

async def handle_client(websocket: websockets.WebSocketServerProtocol, path: str):
    """Обрабатывает подключение клиента"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент подключился")
    connected_clients.add(websocket)
    
    try:
        # Отправляем приветственное сообщение
        await websocket.send(json.dumps({"type": "connected", "message": "Connected to notification server"}))
        
        # Ждем сообщения от клиента (для поддержания соединения)
        async for message in websocket:
            try:
                data = json.loads(message)
                print(f"Получено сообщение от клиента: {data}")
            except json.JSONDecodeError:
                print(f"Получено не-JSON сообщение: {message}")
                
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Клиент отключился")
    finally:
        connected_clients.discard(websocket)

async def send_random_alerts():
    """Фоновая задача для отправки случайных уведомлений"""
    print("📢 Фоновая задача отправки уведомлений запущена")
    
    while True:
        await asyncio.sleep(random.uniform(10, 25))  # Интервал 10-25 секунд
        
        if not connected_clients:
            continue
        
        camera = random.choice(CAMERAS)
        zone = next((z for z in ZONES if z["id"] in camera["zone_ids"]), ZONES[0])
        alert_text = random.choice(ALERT_MESSAGES)
        
        # Отправляем уведомление
        alert_message = {
            'type': 'alert',
            'message': {
                'info': f"{alert_text} (зона {zone['name']})",
                'camera_id': camera['id'],
                'zone_id': zone['id'],
                'timestamp': time.time()
            }
        }
        
        await broadcast(alert_message)
        print(f"🔴 УВЕДОМЛЕНИЕ: {alert_text} | Камера: {camera['id']}, Зона: {zone['id']}")

async def send_random_detections():
    """Фоновая задача для отправки случайных детекций"""
    print("🎯 Фоновая задача отправки детекций запущена")
    
    while True:
        await asyncio.sleep(random.uniform(3, 8))  # Интервал 3-8 секунд
        
        if not connected_clients:
            continue
        
        camera = random.choice(CAMERAS)
        
        # Генерируем детекцию
        detection = generate_detection_points(camera["id"], camera["zone_bounds"])
        
        detection_message = {
            'type': 'detection',
            'message': detection
        }
        
        await broadcast(detection_message)
        print(f"🟡 ДЕТЕКЦИЯ: Камера {camera['id']}, точек: {len(detection['translated_points'])}")

async def main():
    print("=" * 60)
    print("WebSocket сервер уведомлений и детекций")
    print("=" * 60)
    print(f"Порт: {WEBSOCKET_PORT}")
    print(f"Поддерживаемые типы сообщений: detection, alert")
    print("=" * 60)
    
    # Запускаем фоновые задачи
    async with websockets.serve(handle_client, "localhost", WEBSOCKET_PORT):
        print(f"✅ Сервер запущен на ws://localhost:{WEBSOCKET_PORT}")
        
        # Запускаем фоновые задачи
        alert_task = asyncio.create_task(send_random_alerts())
        detection_task = asyncio.create_task(send_random_detections())
        
        try:
            await asyncio.Future()  # Бесконечно ждем
        except KeyboardInterrupt:
            print("\n🛑 Остановка сервера...")
            alert_task.cancel()
            detection_task.cancel()
            await asyncio.gather(alert_task, detection_task, return_exceptions=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Сервер остановлен")