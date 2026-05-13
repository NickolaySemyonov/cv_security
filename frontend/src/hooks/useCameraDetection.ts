// frontend/src/hooks/useCameraDetection.ts
import { useEffect, useState } from 'react';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  personId?: number;  // Добавляем ID человека для отслеживания
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

// Хранилище последних позиций людей по cameraId и personId
let personPositions: Map<string, DetectionPoint> = new Map();

function notifySubscribers() {
  subscribers.forEach(cb => cb([...globalDetections]));
}

async function processDetection(message: DetectionMessage) {
  console.log(`📥 Камера ${message.camera_id}: ${message.translated_points.length} человек`);
  
  const now = Date.now() / 1000;
  const cameraId = message.camera_id;
  
  // Обновляем позиции людей
  message.translated_points.forEach((point, index) => {
    const personId = index; // или можно использовать уникальный ID из сообщения
    const key = `${cameraId}_${personId}`;
    
    const newPoint: DetectionPoint = {
      x: point[0],
      y: point[1],
      cameraId: cameraId,
      personId: personId,
      timestamp: now
    };
    
    personPositions.set(key, newPoint);
  });
  
  // Преобразуем Map в массив для отображения
  globalDetections = Array.from(personPositions.values());
  
  // Удаляем старые точки (если человек пропал из кадра)
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
  
  notifySubscribers();
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