import { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  info: string;
  camera_id: number;
  zone_id: number;
  timestamp: number;
  isRead: boolean;
}

let ws: WebSocket | null = null;
let notificationSubscribers: ((notifications: Notification[]) => void)[] = [];
let activeNotifications: Notification[] = [];
let isConnecting = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const WS_URL = `ws://${window.location.hostname}:8766`;

function addNotification(notification: Omit<Notification, 'id' | 'isRead'>) {
  const newNotification: Notification = {
    ...notification,
    id: `${Date.now()}_${Math.random()}`,
    isRead: false
  };
  
  activeNotifications = [newNotification, ...activeNotifications];
  
  if (activeNotifications.length > 50) {
    activeNotifications = activeNotifications.slice(0, 50);
  }
  
  notificationSubscribers.forEach(cb => cb([...activeNotifications]));
  
  setTimeout(() => {
    const stillExists = activeNotifications.find(n => n.id === newNotification.id);
    if (stillExists && !stillExists.isRead) {
      activeNotifications = activeNotifications.filter(n => n.id !== newNotification.id);
      notificationSubscribers.forEach(cb => cb([...activeNotifications]));
    }
  }, 10000);
}

function markAsRead(notificationId: string) {
  const notification = activeNotifications.find(n => n.id === notificationId);
  if (notification) {
    notification.isRead = true;
    notificationSubscribers.forEach(cb => cb([...activeNotifications]));
  }
  
  setTimeout(() => {
    activeNotifications = activeNotifications.filter(n => n.id !== notificationId);
    notificationSubscribers.forEach(cb => cb([...activeNotifications]));
  }, 500);
}

function clearAllNotifications() {
  activeNotifications = [];
  notificationSubscribers.forEach(cb => cb([]));
}

function removeNotification(notificationId: string) {
  activeNotifications = activeNotifications.filter(n => n.id !== notificationId);
  notificationSubscribers.forEach(cb => cb([...activeNotifications]));
}

function connectWebSocket() {
  if (isConnecting) {
    return;
  }
  
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  isConnecting = true;
  
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('✅ WebSocket уведомлений подключен');
      isConnecting = false;
      connectionAttempts = 0;
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'alert' && data.message) {
          addNotification({
            info: data.message.info,
            camera_id: data.message.camera_id,
            zone_id: data.message.zone_id,
            timestamp: data.message.timestamp
          });
        }
      } catch (error) {
        console.error('Ошибка обработки уведомления:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket уведомлений закрыт');
      ws = null;
      isConnecting = false;
      
      if (notificationSubscribers.length > 0 && connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++;
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket уведомлений ошибка:', error);
      isConnecting = false;
    };
  } catch (error) {
    console.error('Ошибка создания WebSocket уведомлений:', error);
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

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const subscription = (newNotifications: Notification[]) => {
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.isRead).length);
    };
    
    notificationSubscribers.push(subscription);
    
    if (notificationSubscribers.length === 1) {
      connectWebSocket();
    }
    
    return () => {
      const index = notificationSubscribers.indexOf(subscription);
      if (index !== -1) notificationSubscribers.splice(index, 1);
      
      if (notificationSubscribers.length === 0) {
        closeWebSocket();
      }
    };
  }, []);
  
  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAllNotifications,
    removeNotification
  };
}