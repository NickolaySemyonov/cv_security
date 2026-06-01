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

function scheduleRender() {
  if (renderTimeout) return;
  
  renderTimeout = setTimeout(() => {
    renderTimeout = null;
    if (pendingDetections) {
      globalDetections = pendingDetections;
      pendingDetections = null;
      detectionSubscribers.forEach(cb => {
        try {
          cb([...globalDetections]);
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
  const newDetections: DetectionPoint[] = [];
  
  points.forEach((point: number[]) => {
    const relX = point[0];
    const relY = point[1];
    const absolute = scaleToZone(relX, relY, zoneBounds);
    
    if (isPointInZone(absolute.x, absolute.y, vertices)) {
      newDetections.push({
        x: absolute.x,
        y: absolute.y,
        cameraId: cameraId,
        timestamp: timestamp
      });
    }
  });
  
  notifyDetectionSubscribers(newDetections);
}

function addNotification(notification: Omit<Notification, 'id' | 'isRead'>) {
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
    console.log('WebSocket уже подключается, пропускаем');
    return;
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('WebSocket уже открыт, пропускаем');
    return;
  }
  
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    console.log('WebSocket уже подключается, пропускаем');
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
        console.log(`Попытка переподключения ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
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
    globalDetections = [];
    pendingDetections = null;
    setDetections([]);
    console.log(`[${componentId.current}] 📌 Зарегистрированы камеры ${cameraIds.join(', ')} на этаже ${floorId}`);
  };

  const getDetectionsByFloor = (floorId: number): DetectionPoint[] => {
    return detections;
  };

  const clearDetections = () => {
    globalDetections = [];
    pendingDetections = null;
    setDetections([]);
    console.log(`[${componentId.current}] 🧹 Детекции очищены`);
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
    console.log(`[${componentId.current}] Компонент смонтирован, добавляем подписчиков`);
    
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
    console.log(`[${componentId.current}] Всего подписчиков: детекций=${detectionSubscribers.length}, уведомлений=${notificationSubscribers.length}, итого=${totalSubscribers}`);
    
    if (!isInitialized && totalSubscribers > 0) {
      isInitialized = true;
      console.log('Первый подписчик, создаём WebSocket соединение');
      connectWebSocket();
    }
    
    const interval = setInterval(() => {
      if (isMounted.current) {
        const connected = ws !== null && ws.readyState === WebSocket.OPEN;
        setIsConnected(connected);
      }
    }, 1000);
    
    return () => {
      console.log(`[${componentId.current}] Компонент размонтирован, удаляем подписчиков`);
      isMounted.current = false;
      
      const detectionIndex = detectionSubscribers.indexOf(detectionSub);
      if (detectionIndex !== -1) detectionSubscribers.splice(detectionIndex, 1);
      
      const notificationIndex = notificationSubscribers.indexOf(notificationSub);
      if (notificationIndex !== -1) notificationSubscribers.splice(notificationIndex, 1);
      
      clearInterval(interval);
      
      const totalSubscribers = detectionSubscribers.length + notificationSubscribers.length;
      console.log(`Подписчиков после удаления: детекций=${detectionSubscribers.length}, уведомлений=${notificationSubscribers.length}, итого=${totalSubscribers}`);
      
      if (totalSubscribers === 0) {
        console.log('Нет подписчиков, закрываем WebSocket');
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