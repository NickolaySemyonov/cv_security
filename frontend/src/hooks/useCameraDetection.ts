// frontend/src/hooks/useCameraDetection.ts
import { useEffect, useState } from 'react';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

interface DetectionMessage {
  camera_id: number;
  translated_points: number[][];
  timestamp: number;
}

let ws: WebSocket | null = null;
let globalDetections: DetectionPoint[] = [];
let subscribers: ((detections: DetectionPoint[]) => void)[] = [];
let cameraToFloorMap: Map<number, number> = new Map();

function notifySubscribers() {
  subscribers.forEach(cb => cb([...globalDetections]));
}

async function processDetection(message: DetectionMessage) {
  console.log(`📥 Камера ${message.camera_id}:`, message.translated_points);
  
  const newPoints = message.translated_points.map(point => ({
    x: point[0],
    y: point[1],
    cameraId: message.camera_id,
    timestamp: message.timestamp
  }));
  
  globalDetections.push(...newPoints);
  
  if (globalDetections.length > 100) {
    globalDetections = globalDetections.slice(-100);
  }
  
  notifySubscribers();
  
  setTimeout(() => {
    const now = Date.now() / 1000;
    globalDetections = globalDetections.filter(p => p.timestamp > now - 2);
    notifySubscribers();
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

  // Простая фильтрация - без внутреннего состояния
  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    const filtered = detections.filter(d => {
      const cameraFloor = cameraToFloorMap.get(d.cameraId);
      return cameraFloor === floorId;
    });
    console.log(`🔍 Фильтрация для этажа ${floorId}: ${filtered.length} точек из ${detections.length}`);
    return filtered;
  };

  // Очистка детекций
  const clearDetections = () => {
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