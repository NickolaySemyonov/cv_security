// frontend/src/hooks/useCameraDetection.ts
import { useEffect, useState } from 'react';
import api from '../config/axios';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
  personId?: number;
}

interface DetectionMessage {
  camera_id: number;
  translated_points: number[][];
  timestamp: number;
}

interface Camera {
  id: number;
  visible_zone: { vertices: number[][] };
}

let ws: WebSocket | null = null;
let globalDetections: DetectionPoint[] = [];
let subscribers: ((detections: DetectionPoint[]) => void)[] = [];
let cameraToFloorMap: Map<number, number> = new Map();
let cameraZoneCache: Map<number, { minX: number; maxX: number; minY: number; maxY: number } | null> = new Map();

// Загрузка зоны видимости камеры из БД
async function loadCameraZone(cameraId: number): Promise<{ minX: number; maxX: number; minY: number; maxY: number } | null> {
  if (cameraZoneCache.has(cameraId)) {
    return cameraZoneCache.get(cameraId) || null;
  }
  
  try {
    const response = await api.get<Camera>(`/cameras/${cameraId}`);
    const vertices = response.data.visible_zone?.vertices;
    
    if (vertices && vertices.length >= 4) {
      const xs = vertices.map(p => p[0]);
      const ys = vertices.map(p => p[1]);
      const zone = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
      cameraZoneCache.set(cameraId, zone);
      return zone;
    }
  } catch (error) {
    console.error(`Ошибка загрузки зоны для камеры ${cameraId}:`, error);
  }
  
  cameraZoneCache.set(cameraId, null);
  return null;
}

// Преобразование относительных координат (0-1) в абсолютные
function transformRelativeToAbsolute(
  relX: number,
  relY: number,
  zone: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  const x = zone.minX + relX * (zone.maxX - zone.minX);
  const y = zone.minY + relY * (zone.maxY - zone.minY);
  return { x, y };
}

// Хранилище последних позиций людей
let personPositions: Map<string, DetectionPoint> = new Map();

function notifySubscribers() {
  subscribers.forEach(cb => cb([...globalDetections]));
}

async function processDetection(message: DetectionMessage) {
  console.log(`📥 Камера ${message.camera_id}: ${message.translated_points.length} человек`);
  
  // Загружаем зону видимости камеры
  const zone = await loadCameraZone(message.camera_id);
  
  if (!zone) {
    console.warn(`⚠️ Не удалось загрузить зону для камеры ${message.camera_id}`);
    return;
  }
  
  const now = Date.now() / 1000;
  const newPositions: Map<string, DetectionPoint> = new Map();
  
  // Преобразуем каждую точку из относительных в абсолютные координаты
  message.translated_points.forEach((point, index) => {
    const relX = point[0];
    const relY = point[1];
    const absolute = transformRelativeToAbsolute(relX, relY, zone);
    
    const personId = index;
    const key = `${message.camera_id}_${personId}`;
    
    newPositions.set(key, {
      x: absolute.x,
      y: absolute.y,
      cameraId: message.camera_id,
      personId: personId,
      timestamp: now
    });
  });
  
  // Обновляем позиции
  personPositions = newPositions;
  
  // Преобразуем Map в массив для отображения
  globalDetections = Array.from(personPositions.values());
  
  // Ограничиваем количество (на всякий случай)
  if (globalDetections.length > 100) {
    globalDetections = globalDetections.slice(-100);
  }
  
  console.log(`📍 Преобразовано точек: ${globalDetections.length}`);
  notifySubscribers();
  
  // Удаляем старые точки через 2 секунды (если человек пропал)
  setTimeout(() => {
    const currentTime = Date.now() / 1000;
    let changed = false;
    
    for (const [key, point] of personPositions.entries()) {
      if (point.timestamp < currentTime - 2) {
        personPositions.delete(key);
        changed = true;
      }
    }
    
    if (changed) {
      globalDetections = Array.from(personPositions.values());
      notifySubscribers();
    }
  }, 2000);
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  console.log('🔌 Подключение к WebSocket...');
  ws = new WebSocket('ws://localhost:8765');
  
  ws.onopen = () => {
    console.log('✅ WebSocket подключен');
  };
  
  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      await processDetection(data);
    } catch (error) {
      console.error('Ошибка обработки:', error);
    }
  };
  
  ws.onclose = () => {
    console.log('❌ WebSocket отключен');
    ws = null;
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket ошибка:', error);
  };
}

export function useCameraDetection() {
  const [detections, setDetections] = useState<DetectionPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const registerFloorCameras = (floorId: number, cameraIds: number[]) => {
    cameraIds.forEach(cameraId => {
      cameraToFloorMap.set(cameraId, floorId);
    });
    console.log(`📌 Зарегистрированы камеры ${cameraIds.join(', ')} на этаже ${floorId}`);
  };

  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    const filtered = detections.filter(d => {
      const cameraFloor = cameraToFloorMap.get(d.cameraId);
      return cameraFloor === floorId;
    });
    return filtered;
  };

  useEffect(() => {
    const subscription = (newDetections: DetectionPoint[]) => {
      setDetections(newDetections);
    };
    
    subscribers.push(subscription);
    
    if (subscribers.length === 1) {
      connectWebSocket();
    }
    
    const interval = setInterval(() => {
      setIsConnected(ws !== null && ws.readyState === WebSocket.OPEN);
    }, 1000);
    
    return () => {
      const index = subscribers.indexOf(subscription);
      if (index !== -1) subscribers.splice(index, 1);
      clearInterval(interval);
    };
  }, []);
  
  return { 
    detections, 
    getDetectionsByFloor,
    registerFloorCameras,
    isConnected 
  };
}