import { useState, useEffect } from 'react';
import api from '../config/axios';
import { useWebSocket, Notification } from '../hooks/useWebSocket';

interface Incident {
  id: number;
  time: string;
  area_id: number;
  area_name: string;
  camera_id: number;
  info: string;
  floor_id: number;
  floor_map: string;
  zone_vertices: number[][];
}

interface IncidentsListProps {
  user: User | null;
}

interface User {
  id: number;
  login: string;
  role: string;
}

const IncidentsList = ({ user }: IncidentsListProps) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const { notifications } = useWebSocket();

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    // При получении нового уведомления добавляем его в список
    const newNotifications = notifications.filter(n => !n.isRead);
    if (newNotifications.length > 0) {
      newNotifications.forEach(notif => {
        const newIncident: Incident = {
          id: Date.now(),
          time: new Date(notif.timestamp * 1000).toLocaleString(),
          area_id: notif.area_id,
          area_name: `Зона ${notif.area_id}`,
          camera_id: notif.camera_id,
          info: notif.info,
          floor_id: 0,
          floor_map: '',
          zone_vertices: []
        };
        setIncidents(prev => [newIncident, ...prev]);
      });
    }
  }, [notifications]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/incidents');
      setIncidents(response.data);
    } catch (error) {
      console.error('Ошибка загрузки нарушений:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMiniMapWithZone = (incident: Incident): string => {
    if (!incident.floor_map || !incident.zone_vertices) return '';
    
    let modifiedSvg = incident.floor_map;
    
    const hasViewBox = /viewBox=["'][^"']*["']/.test(modifiedSvg);
    if (!hasViewBox) {
      modifiedSvg = modifiedSvg.replace(/<svg/i, '<svg viewBox="0 0 800 600"');
    }
    
    modifiedSvg = modifiedSvg.replace(/<svg/i, '<svg style="width:100%; height:auto; max-height:200px; display:block; margin:0 auto;"');
    
    const points = incident.zone_vertices.map(p => `${p[0]},${p[1]}`).join(' ');
    const polygon = `<polygon points="${points}" fill="rgba(255, 0, 0, 0.4)" stroke="#FF0000" stroke-width="3" stroke-dasharray="6,4" />`;
    modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
    
    return modifiedSvg;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-400">Загрузка нарушений...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-200">История нарушений</h2>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-gray-400">Нет зафиксированных нарушений</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() => setSelectedIncident(selectedIncident?.id === incident.id ? null : incident)}
                className="bg-gray-700/30 rounded-xl border border-gray-600/50 overflow-hidden cursor-pointer transition-all hover:border-gray-500"
              >
                <div className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                      <span className="text-red-400 text-lg">⚠️</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-semibold">Нарушение</span>
                        <span className="text-gray-400 text-sm">Зона #{incident.area_id}</span>
                      </div>
                      <p className="text-gray-300 text-sm mt-1">{incident.info}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>📷 Камера #{incident.camera_id}</span>
                        <span>🕐 {formatDate(incident.time)}</span>
                      </div>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${selectedIncident?.id === incident.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {selectedIncident?.id === incident.id && incident.floor_map && incident.zone_vertices && (
                  <div className="p-4 border-t border-gray-600/50 bg-gray-800/30">
                    <p className="text-sm text-gray-400 mb-3">📍 Место нарушения на карте этажа:</p>
                    <div className="bg-gray-900/50 rounded-lg p-3 flex justify-center">
                      <div
                        dangerouslySetInnerHTML={{ __html: getMiniMapWithZone(incident) }}
                        style={{ maxWidth: '100%', maxHeight: '250px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentsList;