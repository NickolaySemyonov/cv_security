import { useEffect, useState, useRef } from 'react';
import api from '../config/axios';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

export interface Notification {
  id: string;
  info: string;
  camera_id: number;
  area_id: number;
  timestamp: number;
  isRead: boolean;
}

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
}

let ws: WebSocket | null = null;
let detectionSubscribers: ((detections: DetectionPoint[]) => void)[] = [];
let notificationSubscribers: ((notifications: Notification[]) => void)[] = [];
let globalDetections: DetectionPoint[] = [];
let activeNotifications: Notification[] = [];
let cameraInfoCache: Map<number, { zoneBounds: { minX: number; maxX: number; minY: number; maxY: number }, vertices: number[][] } | null> = new Map();
let lastRenderTime = 0;
const RENDER_INTERVAL = 100;

let currentFloorCameraIds: Set<number> = new Set();
let isConnecting = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isInitialized = false;
let pendingDetections: DetectionPoint[] | null = null;
let renderTimeout: NodeJS.Timeout | null = null;

// Хранилище текущих детекций по всем камерам
let allDetections: Map<number, DetectionPoint[]> = new Map();

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8765`;

function isPointInZone(x: number, y: number, vertices: number[][]): boolean {
  if (!vertices || vertices.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i][0];
    const yi = vertices[i][1];
    const xj = vertices[j][0];
    const yj = vertices[j][1];
    
    const intersect = ((yi > y) != (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

async function loadCameraInfo(cameraId: number): Promise<{ zoneBounds: { minX: number; maxX: number; minY: number; maxY: number }, vertices: number[][] } | null> {
  if (cameraInfoCache.has(cameraId)) {
    return cameraInfoCache.get(cameraId);
  }
  
  try {
    const response = await api.get<Camera>(`/cameras/${cameraId}`);
    const vertices = response.data.visible_zone?.vertices;
    
    if (vertices && vertices.length >= 4) {
      const xs = vertices.map(p => p[0]);
      const ys = vertices.map(p => p[1]);
      const zoneBounds = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
      const cameraInfo = { zoneBounds, vertices };
      cameraInfoCache.set(cameraId, cameraInfo);
      return cameraInfo;
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

function getAllDetectionsAsArray(): DetectionPoint[] {
  const result: DetectionPoint[] = [];
  for (const detections of allDetections.values()) {
    result.push(...detections);
  }
  return result;
}

function scheduleRender() {
  if (renderTimeout) return;
  
  renderTimeout = setTimeout(() => {
    renderTimeout = null;
    if (pendingDetections) {
      globalDetections = pendingDetections;
      pendingDetections = null;
      const detectionsCopy = [...globalDetections];
      detectionSubscribers.forEach(cb => {
        try {
          cb(detectionsCopy);
        } catch (err) {
          console.error('Ошибка в подписчике детекций:', err);
        }
      });
    }
  }, RENDER_INTERVAL);
}

function notifyDetectionSubscribers(newDetections: DetectionPoint[]) {
  pendingDetections = newDetections;
  scheduleRender();
}

function notifyNotificationSubscribers() {
  const notificationsCopy = [...activeNotifications];
  notificationSubscribers.forEach(cb => {
    try {
      cb(notificationsCopy);
    } catch (err) {
      console.error('Ошибка в подписчике уведомлений:', err);
    }
  });
}

async function processDetection(data: any) {
  if (data.camera_id === undefined || !data.translated_points) {
    return;
  }
  
  const cameraId = data.camera_id;
  const points = data.translated_points;
  const timestamp = data.timestamp || Date.now() / 1000;
  
  if (!currentFloorCameraIds.has(cameraId)) {
    return;
  }
  
  const cameraInfo = await loadCameraInfo(cameraId);
  if (!cameraInfo) {
    return;
  }
  
  const { zoneBounds, vertices } = cameraInfo;
  const newDetectionsForCamera: DetectionPoint[] = [];
  
  points.forEach((point: number[]) => {
    const relX = point[0];
    const relY = point[1];
    const absolute = scaleToZone(relX, relY, zoneBounds);
    
    if (isPointInZone(absolute.x, absolute.y, vertices)) {
      newDetectionsForCamera.push({
        x: absolute.x,
        y: absolute.y,
        cameraId: cameraId,
        timestamp: timestamp
      });
    }
  });
  
  // Обновляем точки только для этой камеры, остальные камеры не трогаем
  if (newDetectionsForCamera.length > 0) {
    allDetections.set(cameraId, newDetectionsForCamera);
  } else {
    allDetections.delete(cameraId);
  }
  
  notifyDetectionSubscribers(getAllDetectionsAsArray());
}

function addNotification(notification: Omit<Notification, 'id' | 'isRead'>) {
  console.log('🔔 addNotification вызван, area_id:', notification.area_id);
  const newNotification: Notification = {
    ...notification,
    id: `${Date.now()}_${Math.random()}`,
    isRead: false
  };
  
  activeNotifications = [newNotification, ...activeNotifications];
  
  if (activeNotifications.length > 100) {
    activeNotifications = activeNotifications.slice(0, 100);
  }
  
  notifyNotificationSubscribers();
}

function markNotificationAsRead(notificationId: string) {
  const notification = activeNotifications.find(n => n.id === notificationId);
  if (notification) {
    notification.isRead = true;
    notifyNotificationSubscribers();
  }
}

function clearAllNotifications() {
  activeNotifications = [];
  notifyNotificationSubscribers();
}

function removeNotification(notificationId: string) {
  activeNotifications = activeNotifications.filter(n => n.id !== notificationId);
  notifyNotificationSubscribers();
}

function connectWebSocket() {
  if (isConnecting) {
    return;
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }
  
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    return;
  }
  
  isConnecting = true;
  
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log(`✅ WebSocket подключен к ${WS_URL}`);
      isConnecting = false;
      connectionAttempts = 0;
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'detection' && data.message) {
          await processDetection(data.message);
        } else if (data.type === 'alert' && data.message) {
          console.log('🔔 ALERT получен, area_id:', data.message.area_id);
          addNotification({
            info: data.message.info,
            camera_id: data.message.camera_id,
            area_id: data.message.area_id,
            timestamp: data.message.timestamp
          });
        }
      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket закрыт');
      ws = null;
      isConnecting = false;
      
      const totalSubscribers = detectionSubscribers.length + notificationSubscribers.length;
      if (totalSubscribers > 0 && connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++;
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
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
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }
}

export function useWebSocket() {
  const [detections, setDetections] = useState<DetectionPoint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const isMounted = useRef(true);
  const componentId = useRef(Math.random().toString(36).substring(7));

  const registerFloorCameras = async (floorId: number, cameraIds: number[]) => {
    currentFloorCameraIds.clear();
    cameraIds.forEach(id => currentFloorCameraIds.add(id));
    allDetections.clear();
    setDetections([]);
  };

  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    return detections;
  };

  const clearDetections = () => {
    allDetections.clear();
    setDetections([]);
  };

  const markAsRead = (notificationId: string) => {
    markNotificationAsRead(notificationId);
  };

  const clearAllNotificationsLocal = () => {
    clearAllNotifications();
  };

  const removeNotificationLocal = (notificationId: string) => {
    removeNotification(notificationId);
  };

  useEffect(() => {
    isMounted.current = true;
    
    const detectionSub = (newDetections: DetectionPoint[]) => {
      if (isMounted.current) {
        setDetections(newDetections);
      }
    };
    
    const notificationSub = (newNotifications: Notification[]) => {
      if (isMounted.current) {
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.isRead).length);
      }
    };
    
    detectionSubscribers.push(detectionSub);
    notificationSubscribers.push(notificationSub);
    
    const totalSubscribers = detectionSubscribers.length + notificationSubscribers.length;
    
    if (!isInitialized && totalSubscribers > 0) {
      isInitialized = true;
      connectWebSocket();
    }
    
    const interval = setInterval(() => {
      if (isMounted.current) {
        const connected = ws !== null && ws.readyState === WebSocket.OPEN;
        setIsConnected(connected);
      }
    }, 1000);
    
    return () => {
      isMounted.current = false;
      
      const detectionIndex = detectionSubscribers.indexOf(detectionSub);
      if (detectionIndex !== -1) detectionSubscribers.splice(detectionIndex, 1);
      
      const notificationIndex = notificationSubscribers.indexOf(notificationSub);
      if (notificationIndex !== -1) notificationSubscribers.splice(notificationIndex, 1);
      
      clearInterval(interval);
      
      const totalSubscribers = detectionSubscribers.length + notificationSubscribers.length;
      
      if (totalSubscribers === 0) {
        closeWebSocket();
        isInitialized = false;
      }
    };
  }, []);
  
  return { 
    detections,
    notifications,
    unreadCount,
    isConnected,
    getDetectionsByFloor,
    registerFloorCameras,
    clearDetections,
    markAsRead,
    clearAllNotifications: clearAllNotificationsLocal,
    removeNotification: removeNotificationLocal
  };
}