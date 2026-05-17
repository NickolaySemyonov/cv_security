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
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
}

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;

let ws: WebSocket | null = null;
let globalDetections: DetectionPoint[] = [];
let subscribers: ((detections: DetectionPoint[]) => void)[] = [];
let cameraToFloorMap: Map<number, number> = new Map();
let cameraInfoCache: Map<number, { zone: { minX: number; maxX: number; minY: number; maxY: number }; position: { x: number; y: number } } | null> = new Map();
let personPositions: Map<string, DetectionPoint> = new Map();
let lastRenderTime = 0;
const RENDER_INTERVAL = 50;

async function loadCameraInfo(cameraId: number): Promise<{ zone: { minX: number; maxX: number; minY: number; maxY: number }; position: { x: number; y: number } } | null> {
  if (cameraInfoCache.has(cameraId)) {
    return cameraInfoCache.get(cameraId) || null;
  }
  
  try {
    const response = await api.get<Camera>(`/cameras/${cameraId}`);
    const vertices = response.data.visible_zone?.vertices;
    const position = response.data.position;
    
    if (vertices && vertices.length >= 4 && position) {
      const xs = vertices.map(p => p[0]);
      const ys = vertices.map(p => p[1]);
      const zone = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
      const info = { zone, position };
      cameraInfoCache.set(cameraId, info);
      return info;
    }
  } catch (error) {
    console.error(`Ошибка загрузки камеры ${cameraId}:`, error);
  }
  
  cameraInfoCache.set(cameraId, null);
  return null;
}

function transformPointByCameraPosition(
  relX: number,
  relY: number,
  zoneBounds: { minX: number; maxX: number; minY: number; maxY: number },
  cameraPos: { x: number; y: number }
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = zoneBounds;
  
  const distToTop = Math.abs(cameraPos.y - minY);
  const distToBottom = Math.abs(cameraPos.y - maxY);
  const distToLeft = Math.abs(cameraPos.x - minX);
  const distToRight = Math.abs(cameraPos.x - maxX);
  
  const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
  
  let edgeStart: { x: number; y: number };
  let edgeEnd: { x: number; y: number };
  let isHorizontal: boolean;
  
  if (minDist === distToTop) {
    edgeStart = { x: minX, y: minY };
    edgeEnd = { x: maxX, y: minY };
    isHorizontal = true;
  } else if (minDist === distToBottom) {
    edgeStart = { x: minX, y: maxY };
    edgeEnd = { x: maxX, y: maxY };
    isHorizontal = true;
  } else if (minDist === distToLeft) {
    edgeStart = { x: minX, y: minY };
    edgeEnd = { x: minX, y: maxY };
    isHorizontal = false;
  } else {
    edgeStart = { x: maxX, y: minY };
    edgeEnd = { x: maxX, y: maxY };
    isHorizontal = false;
  }
  
  let oppositeStart: { x: number; y: number };
  let oppositeEnd: { x: number; y: number };
  
  if (isHorizontal) {
    oppositeStart = { x: minX, y: minY };
    oppositeEnd = { x: minX, y: maxY };
  } else {
    oppositeStart = { x: minX, y: minY };
    oppositeEnd = { x: maxX, y: minY };
  }
  
  const t1 = isHorizontal ? relX : relY;
  const cameraEdgePoint = {
    x: edgeStart.x + t1 * (edgeEnd.x - edgeStart.x),
    y: edgeStart.y + t1 * (edgeEnd.y - edgeStart.y)
  };
  
  const t2 = isHorizontal ? relY : relX;
  const oppositePoint = {
    x: oppositeStart.x + t2 * (oppositeEnd.x - oppositeStart.x),
    y: oppositeStart.y + t2 * (oppositeEnd.y - oppositeStart.y)
  };
  
  const depth = isHorizontal ? relY : relX;
  
  return {
    x: cameraEdgePoint.x + depth * (oppositePoint.x - cameraEdgePoint.x),
    y: cameraEdgePoint.y + depth * (oppositePoint.y - cameraEdgePoint.y)
  };
}

function notifySubscribers() {
  const now = Date.now();
  if (now - lastRenderTime >= RENDER_INTERVAL) {
    lastRenderTime = now;
    subscribers.forEach(cb => cb([...globalDetections]));
  }
}

async function processDetection(message: DetectionMessage) {
  const cameraInfo = await loadCameraInfo(message.camera_id);
  if (!cameraInfo) return;
  
  const now = Date.now() / 1000;
  
  message.translated_points.forEach((point, index) => {
    const relX = point[0] / FRAME_WIDTH;
    const relY = point[1] / FRAME_HEIGHT;
    
    const absolute = transformPointByCameraPosition(
      relX, relY,
      cameraInfo.zone,
      cameraInfo.position
    );
    
    const personId = index;
    const key = `${message.camera_id}_${personId}`;
    
    personPositions.set(key, {
      x: absolute.x,
      y: absolute.y,
      cameraId: message.camera_id,
      personId: personId,
      timestamp: now
    });
  });
  
  // Удаляем старые точки
  for (const [key, point] of personPositions.entries()) {
    if (point.timestamp < now - 2) {
      personPositions.delete(key);
    }
  }
  
  globalDetections = Array.from(personPositions.values());
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

  // Регистрация камер на этаже (перезаписываем старые)
  const registerFloorCameras = (floorId: number, cameraIds: number[]) => {
    // Очищаем старые регистрации для этого этажа
    for (const [camId, camFloor] of cameraToFloorMap.entries()) {
      if (camFloor === floorId) {
        cameraToFloorMap.delete(camId);
      }
    }
    
    cameraIds.forEach(cameraId => {
      cameraToFloorMap.set(cameraId, floorId);
    });
    
    console.log(`📌 Зарегистрированы камеры ${cameraIds.join(', ')} на этаже ${floorId}`);
    console.log(`📌 Текущая карта камер:`, Array.from(cameraToFloorMap.entries()));
  };

  // Получение детекций для конкретного этажа
  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    const filtered = detections.filter(d => {
      const cameraFloor = cameraToFloorMap.get(d.cameraId);
      return cameraFloor === floorId;
    });
    return filtered;
  };

  // Очистка всех детекций (при смене этажа)
  const clearDetections = () => {
    personPositions.clear();
    globalDetections = [];
    notifySubscribers();
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