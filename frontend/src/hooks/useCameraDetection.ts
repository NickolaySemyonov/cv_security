import { useEffect, useState } from 'react';
import api from '../config/axios';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
}

let ws: WebSocket | null = null;
let globalDetections: DetectionPoint[] = [];
let subscribers: ((detections: DetectionPoint[]) => void)[] = [];
let cameraInfoCache: Map<number, { minX: number; maxX: number; minY: number; maxY: number } | null> = new Map();
let lastRenderTime = 0;
const RENDER_INTERVAL = 50;

let currentFloorCameraIds: Set<number> = new Set();

async function loadCameraInfo(cameraId: number): Promise<{ minX: number; maxX: number; minY: number; maxY: number } | null> {
  if (cameraInfoCache.has(cameraId)) {
    return cameraInfoCache.get(cameraId);
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
      cameraInfoCache.set(cameraId, zone);
      return zone;
    }
  } catch (error) {
    console.error(`Ошибка загрузки камеры ${cameraId}:`, error);
  }
  
  cameraInfoCache.set(cameraId, null);
  return null;
}

function scaleToZone(
  relX: number,
  relY: number,
  zoneBounds: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = zoneBounds;
  const x = minX + relX * (maxX - minX);
  const y = minY + relY * (maxY - minY);
  return { x, y };
}

function notifySubscribers() {
  const now = Date.now();
  if (now - lastRenderTime >= RENDER_INTERVAL) {
    lastRenderTime = now;
    subscribers.forEach(cb => cb([...globalDetections]));
  }
}

async function processDetection(data: any) {
  console.log('📨 Получено сообщение:', data);
  
  // Поддержка формата { type: 'detection', message: {...} }
  let detectionData = data;
  if (data.type === 'detection' && data.message) {
    detectionData = data.message;
  }
  
  // Проверяем наличие нужных полей
  if (detectionData.camera_id === undefined || !detectionData.translated_points) {
    console.log('⚠️ Неизвестный формат сообщения:', data);
    return;
  }
  
  const cameraId = detectionData.camera_id;
  const points = detectionData.translated_points;
  const timestamp = detectionData.timestamp || Date.now() / 1000;
  
  console.log(`📹 Камера ${cameraId}, точек: ${points.length}`);
  
  if (!currentFloorCameraIds.has(cameraId)) {
    console.log(`❌ Камера ${cameraId} не принадлежит текущему этажу`);
    return;
  }
  
  const cameraInfo = await loadCameraInfo(cameraId);
  if (!cameraInfo) {
    console.log(`❌ Нет информации о зоне камеры ${cameraId}`);
    return;
  }
  
  const newDetections: DetectionPoint[] = [];
  
  points.forEach((point: number[], index: number) => {
    const relX = point[0];
    const relY = point[1];
    
    const absolute = scaleToZone(relX, relY, cameraInfo);
    
    newDetections.push({
      x: absolute.x,
      y: absolute.y,
      cameraId: cameraId,
      timestamp: timestamp
    });
  });
  
  globalDetections = newDetections;
  console.log(`✅ Точки: ${globalDetections.length}`);
  notifySubscribers();
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
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
    console.log('WebSocket закрыт, переподключение...');
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

  const registerFloorCameras = async (floorId: number, cameraIds: number[]) => {
    currentFloorCameraIds.clear();
    cameraIds.forEach(id => currentFloorCameraIds.add(id));
    
    globalDetections = [];
    setDetections([]);
    
    console.log(`📌 Зарегистрированы камеры ${cameraIds.join(', ')} на этаже ${floorId}`);
  };

  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    return detections;
  };

  const clearDetections = () => {
    globalDetections = [];
    setDetections([]);
    console.log('🧹 Детекции очищены');
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
    clearDetections,
    isConnected 
  };
}