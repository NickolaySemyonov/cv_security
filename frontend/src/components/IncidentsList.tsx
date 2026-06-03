import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';

interface Incident {
  id: number;
  time: string;
  area_id: number;
  area_name: string;
  camera_id: number;
  info: string;
  floor_id: number;
  floor_number: number;
  floor_map: string;
  zone_polygons: number[][][];  // Массив полигонов
}

interface User {
  id: number;
  login: string;
  role: string;
}

interface IncidentsListProps {
  user: User | null;
}

const IncidentsList = ({ user }: IncidentsListProps) => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    filterIncidents();
  }, [dateFrom, dateTo, incidents]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/incidents');
      setIncidents(response.data);
      setFilteredIncidents(response.data);
    } catch (error) {
      console.error('Ошибка загрузки нарушений:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterIncidents = () => {
    let filtered = [...incidents];
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(inc => new Date(inc.time) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(inc => new Date(inc.time) <= toDate);
    }
    
    setFilteredIncidents(filtered);
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleBack = () => {
    navigate('/objects');
  };

  const getMiniMapWithZone = (incident: Incident): string => {
    if (!incident.floor_map) {
      return '<div style="padding: 20px; text-align: center; color: #666;">Карта этажа недоступна</div>';
    }
    
    let modifiedSvg = incident.floor_map;
    
    const hasViewBox = /viewBox=["'][^"']*["']/.test(modifiedSvg);
    if (!hasViewBox) {
      const widthMatch = modifiedSvg.match(/width=["']([0-9.]+)/);
      const heightMatch = modifiedSvg.match(/height=["']([0-9.]+)/);
      if (widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        modifiedSvg = modifiedSvg.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
      } else {
        modifiedSvg = modifiedSvg.replace(/<svg/i, `<svg viewBox="0 0 800 600"`);
      }
    }
    
    modifiedSvg = modifiedSvg.replace(/<svg/i, '<svg style="width:100%; height:auto; max-height:250px; display:block; margin:0 auto;"');
    
    // Рисуем каждый полигон отдельно
    if (incident.zone_polygons && incident.zone_polygons.length > 0) {
      incident.zone_polygons.forEach(polygon => {
        if (polygon && polygon.length >= 4) {
          const points = polygon.map(p => `${p[0]},${p[1]}`).join(' ');
          const polygonElement = `<polygon points="${points}" fill="rgba(255, 0, 0, 0.4)" stroke="#FF0000" stroke-width="2.5" stroke-dasharray="6,4" />`;
          modifiedSvg = modifiedSvg.replace('</svg>', polygonElement + '</svg>');
        }
      });
    }
    
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
      <div className="min-h-screen


bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
        <div className="flex justify-center items-center flex-grow">
          <div className="text-gray-400">Загрузка нарушений...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
      <main className="flex-grow max-w-7xl mx-auto px-6 py-8">
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm">Назад</span>
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-200">История нарушений</h2>
              <span className="px-2 py-1 bg-gray-700 rounded-lg text-sm text-gray-400">{filteredIncidents.length}</span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-700/30 rounded-xl border border-gray-600/50">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-300 font-medium">Фильтр по дате</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm text-gray-400 mb-1">С даты</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm text-gray-400 mb-1">По дату</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Сбросить
                </button>
              </div>
            </div>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔒</div>
              <p


className="text-gray-400">Нет зафиксированных нарушений</p>
              {(dateFrom || dateTo) && (
                <button
                  onClick={resetFilters}
                  className="mt-4 text-blue-400 hover:text-blue-300"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(selectedIncident?.id === incident.id ? null : incident)}
                  className={`bg-gray-700/30 rounded-xl border transition-all cursor-pointer ${
                    selectedIncident?.id === incident.id 
                      ? 'border-red-500/50 shadow-lg shadow-red-500/10' 
                      : 'border-gray-600/50 hover:border-gray-500'
                  }`}
                >
                  <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <span className="text-red-400 text-lg">⚠️</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-semibold">Нарушение</span>
                          <span className="text-gray-400 text-sm">{incident.area_name}</span>
                          <span className="text-xs text-gray-500">• Этаж {incident.floor_number}</span>
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

                  {selectedIncident?.id === incident.id && (
                    <div className="p-4 border-t border-gray-600/50 bg-gray-800/30">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-400">📍 Зона нарушения на карте этажа {incident.floor_number}:</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 flex justify-center">
                        <div
                          dangerouslySetInnerHTML={{ __html: getMiniMapWithZone(incident) }}
                          style={{ maxWidth: '100%', maxHeight: '250px' }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                          <span


className="text-gray-400">Охраняемая зона (камеры зоны)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default IncidentsList;