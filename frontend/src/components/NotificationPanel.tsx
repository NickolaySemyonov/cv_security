import { useState, useEffect } from 'react';
import { useWebSocket, Notification } from '../hooks/useWebSocket';

interface NotificationPanelProps {
  onAreaBlink?: (areaId: number | null) => void;
}

const NotificationPanel = ({ onAreaBlink }: NotificationPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const { notifications, unreadCount, markAsRead, clearAllNotifications, removeNotification } = useWebSocket();

  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length > 0 && onAreaBlink) {
      const latestAreaId = unreadNotifications[0].area_id || unreadNotifications[0].camera_id;
      onAreaBlink(latestAreaId);
      setIsBlinking(true);
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else if (unreadNotifications.length === 0 && onAreaBlink) {
      onAreaBlink(null);
      setIsBlinking(false);
    }
  }, [notifications, onAreaBlink]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  const handleCloseNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    removeNotification(notificationId);
  };

  const handleOpenPanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      setIsBlinking(false);
    }
  };

  const getDisplayAreaId = (notification: Notification): number => {
    return notification.area_id || notification.camera_id;
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpenPanel}
        className={`relative p-2 rounded-xl transition-all duration-200 group ${
          isBlinking 
            ? 'bg-red-500/20 text-red-400 animate-pulse-ring' 
            : unreadCount > 0 
              ? 'bg-red-500/20 text-red-400' 
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
        title="Уведомления"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full shadow-lg shadow-red-500/50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 z-50 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 animate-slideIn overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800/95">
              <h3 className="text-lg font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                🔔 Уведомления
              </h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Очистить все
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-auto bg-gray-800/95">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-gray-500">Нет уведомлений</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer transition-all duration-200 ${
                        notification.isRead 
                          ? 'hover:bg-gray-700/50' 
                          : 'bg-red-500/10 hover:bg-red-500/20 border-l-2 border-l-red-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-500 text-lg">🔴</span>
                            <span className="font-semibold text-gray-300 text-sm">
                              Зона #{getDisplayAreaId(notification)}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mb-2">{notification.info}</p>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>🕐 {formatTime(notification.timestamp)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleCloseNotification(e, notification.id)}
                          className="text-gray-500 hover:text-gray-300 transition-colors ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationPanel;