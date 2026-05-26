// frontend/src/components/ScheduleManager.tsx
import { useState, useEffect, useRef } from 'react';
import api from '../config/axios';

interface Schedule {
  id: number;
  start_time: string;
  end_time: string;
  day: string;
  area_id: number;
}

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_active: boolean;
  is_configured?: boolean;
}

interface Zone {
  id: number;
  type: string;
  red_zone: boolean;
  floor_id: number;
  cameras: Camera[];
}

interface ScheduleManagerProps {
  areaId: number;
  areaName: string;
  areaType: string;
  floorMap: string;
  zoneCameras: Camera[];
  onClose: () => void;
  onScheduleChange: () => void;
  onZoneTypeChange?: () => void;
}

const days = [
  { value: 'Monday', label: 'Понедельник' },
  { value: 'Tuesday', label: 'Вторник' },
  { value: 'Wednesday', label: 'Среда' },
  { value: 'Thursday', label: 'Четверг' },
  { value: 'Friday', label: 'Пятница' },
  { value: 'Saturday', label: 'Суббота' },
  { value: 'Sunday', label: 'Воскресенье' }
];

// Функция для проверки, активен ли интервал сейчас
const isScheduleActiveNow = (schedule: Schedule): boolean => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotal = currentHour * 60 + currentMinute;
  
  const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayEn = daysEn[now.getDay()];
  
  if (schedule.day !== currentDayEn) {
    return false;
  }
  
  const startHour = parseInt(schedule.start_time.split(':')[0]);
  const startMinute = parseInt(schedule.start_time.split(':')[1]);
  const endHour = parseInt(schedule.end_time.split(':')[0]);
  const endMinute = parseInt(schedule.end_time.split(':')[1]);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  
  if (startTotal <= endTotal) {
    return startTotal <= currentTotal && currentTotal <= endTotal;
  } else {
    return currentTotal >= startTotal || currentTotal <= endTotal;
  }
};

// Функция нормализации SVG для мини-карты
const normalizeSvgForMiniMap = (svgContent: string): string => {
  if (!svgContent) return '';
  
  let svg = svgContent;
  
  const hasViewBox = /viewBox=["'][^"']*["']/.test(svg);
  
  if (!hasViewBox) {
    const widthMatch = svg.match(/width=["']([0-9.]+)/);
    const heightMatch = svg.match(/height=["']([0-9.]+)/);
    
    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
    } else {
      svg = svg.replace(/<svg/i, `<svg viewBox="0 0 800 600"`);
    }
  }
  
  // Устанавливаем фиксированные размеры для мини-карты
  svg = svg.replace(/<svg/i, `<svg style="width:100%; height:auto; max-height:250px; display:block;"`);
  
  return svg;
};

const ScheduleManager = ({ 
  areaId, 
  areaName, 
  areaType, 
  floorMap,
  zoneCameras,
  onClose, 
  onScheduleChange,
  onZoneTypeChange 
}: ScheduleManagerProps) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [currentZoneType, setCurrentZoneType] = useState(areaType);
  const [togglingProtection, setTogglingProtection] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, [areaId]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/schedules/area/${areaId}`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Ошибка загрузки расписания:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateZoneColors = async () => {
    try {
      await api.post('/areas/update-colors-by-schedule');
    } catch (error) {
      console.error('Ошибка обновления цветов:', error);
    }
  };

  const handleToggleProtection = async () => {
    setTogglingProtection(true);
    try {
      const response = await api.post(`/areas/${areaId}/toggle-type`);
      setCurrentZoneType(response.data.type);
      if (onZoneTypeChange) {
        onZoneTypeChange();
      }
      await updateZoneColors();
    } catch (error) {
      console.error('Ошибка переключения защиты:', error);
      alert('Ошибка при переключении типа зоны');
    } finally {
      setTogglingProtection(false);
    }
  };

  const handleAddSchedule = async () => {
    if (startTime >= endTime) {
      alert('⏰ Время начала должно быть меньше времени окончания');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/schedules/', {
        start_time: startTime,
        end_time: endTime,
        day: selectedDay,
        area_id: areaId
      });
      
      await updateZoneColors();
      await fetchSchedules();
      onScheduleChange();
      setShowAddForm(false);
      setStartTime('09:00');
      setEndTime('18:00');
    } catch (error: any) {
      console.error('Ошибка добавления:', error);
      const errorMsg = error.response?.data?.detail || 'Ошибка при добавлении интервала';
      if (errorMsg.includes('пересекается')) {
        alert('❌ Интервал пересекается с существующим расписанием!\n\nВыберите другое время.');
      } else {
        alert(`❌ ${errorMsg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!window.confirm('Удалить этот интервал?')) return;
    
    try {
      await api.delete(`/schedules/${scheduleId}`);
      await updateZoneColors();
      await fetchSchedules();
      onScheduleChange();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка при удалении интервала');
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;
    
    if (startTime >= endTime) {
      alert('⏰ Время начала должно быть меньше времени окончания');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/schedules/${editingSchedule.id}`, {
        start_time: startTime,
        end_time: endTime,
        day: selectedDay
      });
      
      await updateZoneColors();
      await fetchSchedules();
      onScheduleChange();
      setEditingSchedule(null);
      setShowAddForm(false);
    } catch (error: any) {
      console.error('Ошибка обновления:', error);
      const errorMsg = error.response?.data?.detail || 'Ошибка при обновлении интервала';
      if (errorMsg.includes('пересекается')) {
        alert('❌ Интервал пересекается с существующим расписанием!\n\nВыберите другое время.');
      } else {
        alert(`❌ ${errorMsg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const editSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setSelectedDay(schedule.day);
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setShowAddForm(true);
  };

  const getSchedulesForDay = (day: string) => {
    return schedules.filter(s => s.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  // Генерация мини-карты с выделенной зоной
  const getMiniMapWithZone = (): string => {
    if (!floorMap) return '';
    
    let modifiedSvg = normalizeSvgForMiniMap(floorMap);
    
    // Рисуем зоны видимости камер, входящих в эту зону
    zoneCameras.forEach((camera) => {
      if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        const color = currentZoneType === 'red' 
          ? 'rgba(255, 80, 80, 0.4)' 
          : 'rgba(80, 255, 80, 0.4)';
        const strokeColor = currentZoneType === 'red' ? '#FF4444' : '#44FF44';
        const polygon = `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="4,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
      
      // Рисуем иконку камеры
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        const cameraIcon = `
          <g transform="translate(${x - 8}, ${y - 8})">
            <circle cx="8" cy="8" r="8" fill="#000000" stroke="#FFFFFF" stroke-width="1.5" />
            <circle cx="8" cy="8" r="4" fill="#FFFFFF" />
            <circle cx="8" cy="8" r="2" fill="#000000" />
          </g>
        `;
        modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
      }
    });
    
    return modifiedSvg;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Заголовок с информацией о зоне */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">⏰ Расписание охраны</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                currentZoneType === 'red' 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {currentZoneType === 'red' ? '🔴 Красная зона' : '🟢 Зелёная зона'}
              </div>
              <span className="text-xs text-gray-500">
                Зона #{areaId} — {areaName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Левая колонка - мини-карта */}
          <div className="w-1/2 p-3 border-r border-gray-200 flex flex-col">
            <h3 className="font-medium text-gray-700 text-sm mb-2">🗺️ Зона на карте</h3>
            <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-center" style={{ minHeight: '250px', maxHeight: '280px' }}>
              <div
                dangerouslySetInnerHTML={{ __html: getMiniMapWithZone() }}
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '250px',
                  width: 'auto',
                  height: 'auto',
                  overflow: 'hidden'
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Выделены камеры, входящие в зону #{areaId}
            </p>
          </div>

          {/* Правая колонка - управление расписанием */}
          <div className="w-1/2 flex flex-col">
            {/* Панель управления защитой зоны */}
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">Статус охраны:</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${currentZoneType === 'green' ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                      🟢 Выкл
                    </span>
                    <button
                      onClick={handleToggleProtection}
                      disabled={togglingProtection}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                        currentZoneType === 'red' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      title={currentZoneType === 'red' ? 'Выключить охрану' : 'Включить охрану'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          currentZoneType === 'red' ? 'translate-x-5.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-xs ${currentZoneType === 'red' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      🔴 Вкл
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  💡 В обход расписания
                </div>
              </div>
            </div>

            {/* Кнопка добавления интервала */}
            <div className="p-3 border-b border-gray-200">
              {!showAddForm ? (
                <button
                  onClick={() => {
                    setEditingSchedule(null);
                    setShowAddForm(true);
                    setSelectedDay('Monday');
                    setStartTime('09:00');
                    setEndTime('18:00');
                  }}
                  className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Добавить интервал
                </button>
              ) : (
                <div className="bg-blue-50 rounded-lg p-3">
                  <h3 className="font-medium text-blue-800 text-sm mb-2">
                    {editingSchedule ? '✏️ Редактировать' : '➕ Новый интервал'}
                  </h3>
                  <div className="space-y-2">
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {days.map(day => (
                        <option key={day.value} value={day.value}>{day.label}</option>
                      ))}
                    </select>
                    
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="self-center text-gray-500 text-sm">—</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={editingSchedule ? handleUpdateSchedule : handleAddSchedule}
                        disabled={submitting}
                        className="flex-1 bg-green-500 text-white px-2 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm"
                      >
                        {submitting ? 'Сохранение...' : (editingSchedule ? 'Сохранить' : 'Добавить')}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingSchedule(null);
                        }}
                        className="flex-1 bg-gray-500 text-white px-2 py-1.5 rounded-lg hover:bg-gray-600 text-sm"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Интервалы не должны пересекаться
                  </p>
                </div>
              )}
            </div>

            {/* Список расписания */}
            <div className="flex-1 overflow-auto p-3">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-gray-500 text-sm">Загрузка...</div>
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  <div className="text-3xl mb-1">⏰</div>
                  <p className="text-sm">Нет интервалов</p>
                  <p className="text-xs mt-1">Нажмите "Добавить"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {days.map(day => {
                    const daySchedules = getSchedulesForDay(day.value);
                    if (daySchedules.length === 0) return null;
                    
                    return (
                      <div key={day.value} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-2 py-1 text-xs font-medium">{day.label}</div>
                        <div className="divide-y">
                          {daySchedules.map(schedule => {
                            const isActive = isScheduleActiveNow(schedule);
                            
                            return (
                              <div key={schedule.id} className="px-2 py-1.5 flex justify-between items-center hover:bg-gray-50">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs">🕐</span>
                                  <span className="font-mono text-xs">
                                    {formatTime(schedule.start_time)}-{formatTime(schedule.end_time)}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded-full">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => editSchedule(schedule)}
                                    className="text-yellow-600 hover:text-yellow-800 text-xs px-1"
                                    title="Редактировать"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                    className="text-red-600 hover:text-red-800 text-xs px-1"
                                    title="Удалить"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Подсказка */}
        <div className="p-2 border-t border-gray-200 bg-gray-50">
          <p className="text-[11px] text-gray-500 text-center">
            🟢 Зелёная - охрана выкл | 🔴 Красная - охрана вкл | ⏰ По расписанию меняется автоматически
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScheduleManager;