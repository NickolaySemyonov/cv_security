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
let isConnecting = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

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
  let detectionData = data;
  if (data.type === 'detection' && data.message) {
    detectionData = data.message;
  }
  
  if (detectionData.camera_id === undefined || !detectionData.translated_points) {
    return;
  }
  
  const cameraId = detectionData.camera_id;
  const points = detectionData.translated_points;
  const timestamp = detectionData.timestamp || Date.now() / 1000;
  
  if (!currentFloorCameraIds.has(cameraId)) {
    return;
  }
  
  const cameraInfo = await loadCameraInfo(cameraId);
  if (!cameraInfo) {
    return;
  }
  
  const newDetections: DetectionPoint[] = [];
  
  points.forEach((point: number[]) => {
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
  notifySubscribers();
}

function connectWebSocket() {
  if (isConnecting) {
    return;
  }
  
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  isConnecting = true;
  const WS_URL = `ws://${window.location.hostname}:8765`;
  
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('✅ WebSocket детекций подключен');
      isConnecting = false;
      connectionAttempts = 0;
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
      console.log('WebSocket детекций закрыт');
      ws = null;
      isConnecting = false;
      
      if (subscribers.length > 0 && connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++;
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket детекций ошибка:', error);
      isConnecting = false;
    };
  } catch (error) {
    console.error('Ошибка создания WebSocket:', error);
    isConnecting = false;
  }
}

function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnecting = false;
  connectionAttempts = 0;
}

export function useCameraDetection() {
  const [detections, setDetections] = useState<DetectionPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const registerFloorCameras = async (floorId: number, cameraIds: number[]) => {
    currentFloorCameraIds.clear();
    cameraIds.forEach(id => currentFloorCameraIds.add(id));
    globalDetections = [];
    setDetections([]);
  };

  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    return detections;
  };

  const clearDetections = () => {
    globalDetections = [];
    setDetections([]);
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
      
      if (subscribers.length === 0) {
        closeWebSocket();
      }
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