import { useState, useEffect, useCallback } from 'react';
import api from '../config/axios';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';

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

interface ScheduleManagerProps {
  areaId: number;
  areaName: string;
  areaType: string;
  areaDisabled: boolean;
  floorMap: string;
  zoneCameras: Camera[];
  onClose: () => void;
  onScheduleChange: () => void;
  onZoneTypeChange?: () => void;
  onBackToList?: () => void;
  isAdmin: boolean;
  showAlert?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
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
  
  svg = svg.replace(/<svg/i, `<svg style="width:100%; height:auto; max-height:280px; display:block; margin:0 auto;"`);
  
  return svg;
};

const ScheduleManager = ({ 
  areaId, 
  areaName, 
  areaType, 
  areaDisabled,
  floorMap,
  zoneCameras,
  onClose, 
  onScheduleChange,
  onZoneTypeChange,
  onBackToList,
  isAdmin,
  showAlert
}: ScheduleManagerProps) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(areaDisabled);
  const [togglingProtection, setTogglingProtection] = useState(false);
  const [currentZoneType, setCurrentZoneType] = useState(areaType);
  const [miniMapKey, setMiniMapKey] = useState(0);
  const { confirm, isOpen: confirmOpen, options, handleConfirm, handleCancel } = useConfirm();

  useEffect(() => {
    fetchSchedules();
  }, [areaId]);

  useEffect(() => {
    setIsDisabled(areaDisabled);
    setCurrentZoneType(areaType);
  }, [areaDisabled, areaType]);

  useEffect(() => {
    setMiniMapKey(prev => prev + 1);
  }, [isDisabled, currentZoneType]);

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
      setMiniMapKey(prev => prev + 1);
      if (onZoneTypeChange) {
        onZoneTypeChange();
      }
    } catch (error) {
      console.error('Ошибка обновления цветов:', error);
    }
  };

  const handleToggleDisabled = async () => {
    setTogglingProtection(true);
    const newDisabled = !isDisabled;
    
    setIsDisabled(newDisabled);
    if (newDisabled) {
      setCurrentZoneType('green');
    } else {
      setCurrentZoneType('loading');
    }
    
    try {
      const response = await api.post(`/areas/${areaId}/toggle-disabled`);
      setIsDisabled(response.data.disabled);
      setCurrentZoneType(response.data.type);
      
      if (onZoneTypeChange) {
        onZoneTypeChange();
      }
      
      await updateZoneColors();
      setMiniMapKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Ошибка переключения охраны:', error);
      setIsDisabled(areaDisabled);
      setCurrentZoneType(areaType);
      showAlert?.('Ошибка при переключении охраны зоны', 'error');
    } finally {
      setTimeout(() => setTogglingProtection(false), 500);
    }
  };

  const handleAddSchedule = async () => {
    if (!isAdmin) {
      showAlert?.('Только администратор может добавлять интервалы', 'warning');
      return;
    }
    
    if (!isDisabled) {
      showAlert?.('Сначала отключите охрану зоны вручную, чтобы изменить расписание', 'warning');
      return;
    }
    
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
      setMiniMapKey(prev => prev + 1);
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
    if (!isAdmin) {
      showAlert?.('Только администратор может удалять интервалы', 'warning');
      return;
    }
    
    if (!isDisabled) {
      showAlert?.('Сначала отключите охрану зоны вручную, чтобы изменить расписание', 'warning');
      return;
    }
    
    const scheduleToDelete = schedules.find(s => s.id === scheduleId);
    const confirmed = await confirm({
      title: 'Удаление интервала',
      message: `Удалить интервал ${scheduleToDelete?.start_time || ''} - ${scheduleToDelete?.end_time || ''}?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/schedules/${scheduleId}`);
      await updateZoneColors();
      await fetchSchedules();
      onScheduleChange();
      setMiniMapKey(prev => prev + 1);
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка при удалении интервала');
    }
  };

  const handleUpdateSchedule = async () => {
    if (!isAdmin) {
      showAlert?.('Только администратор может редактировать интервалы', 'warning');
      return;
    }
    
    if (!isDisabled) {
      showAlert?.('Сначала отключите охрану зоны вручную, чтобы изменить расписание', 'warning');
      return;
    }
    
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
      setMiniMapKey(prev => prev + 1);
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
    if (!isAdmin) {
      showAlert?.('Только администратор может редактировать интервалы', 'warning');
      return;
    }
    
    if (!isDisabled) {
      showAlert?.('Сначала отключите охрану зоны вручную, чтобы изменить расписание', 'warning');
      return;
    }
    
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

  const getZoneColor = useCallback(() => {
    if (isDisabled) {
      return {
        fill: 'rgba(128, 128, 128, 0.35)',
        stroke: '#888888',
        cameraFill: '#888888',
        cameraStroke: '#CCCCCC'
      };
    }
    if (currentZoneType === 'red') {
      return {
        fill: 'rgba(239, 68, 68, 0.35)',
        stroke: '#EF4444',
        cameraFill: '#EF4444',
        cameraStroke: '#FCA5A5'
      };
    }
    return {
      fill: 'rgba(34, 197, 94, 0.35)',
      stroke: '#22C55E',
      cameraFill: '#22C55E',
      cameraStroke: '#86EFAC'
    };
  }, [isDisabled, currentZoneType]);

  const getMiniMapWithZone = useCallback((): string => {
    if (!floorMap) return '';
    
    let modifiedSvg = normalizeSvgForMiniMap(floorMap);
    const zoneColor = getZoneColor();
    
    zoneCameras.forEach((camera) => {
      if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = `<polygon points="${points}" fill="${zoneColor.fill}" stroke="${zoneColor.stroke}" stroke-width="3" stroke-dasharray="6,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
      
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        const cameraIcon = `
          <g transform="translate(${x - 10}, ${y - 10})">
            <circle cx="10" cy="10" r="10" fill="${zoneColor.cameraFill}" stroke="${zoneColor.cameraStroke}" stroke-width="1.5" />
            <circle cx="10" cy="10" r="5" fill="#fff" opacity="0.8" />
            <circle cx="10" cy="10" r="2.5" fill="${zoneColor.cameraFill}" />
          </g>
        `;
        modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
      }
    });
    
    return modifiedSvg;
  }, [floorMap, zoneCameras, getZoneColor]);

  const canEditSchedule = isAdmin && isDisabled;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" style={{ paddingTop: '8vh' }}>
      <ConfirmModal
        isOpen={confirmOpen}
        title={options?.title || ''}
        message={options?.message || ''}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        confirmVariant={options?.confirmVariant || 'danger'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-scaleIn overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDisabled 
                ? 'bg-gradient-to-br from-gray-500 to-gray-600' 
                : (currentZoneType === 'red' 
                  ? 'bg-gradient-to-br from-red-500 to-red-600' 
                  : 'bg-gradient-to-br from-green-500 to-green-600')
            }`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Расписание охраны</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isDisabled 
                    ? 'bg-gray-100 text-gray-600' 
                    : (currentZoneType === 'red' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                }`}>
                  {isDisabled 
                    ? '🌿 Охрана отключена' 
                    : (currentZoneType === 'red' ? '🔴 Охрана активна' : '🟢 Охрана неактивна')}
                </div>
                <span className="text-xs text-gray-400">
                  Зона #{areaId}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-2/5 p-5 border-r border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDisabled 
                  ? 'bg-gradient-to-br from-gray-500 to-gray-600' 
                  : (currentZoneType === 'red' 
                    ? 'bg-gradient-to-br from-red-500 to-red-600' 
                    : 'bg-gradient-to-br from-green-500 to-green-600')
              }`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-700">Зона на карте</h3>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-center shadow-sm">
              <div
                key={miniMapKey}
                dangerouslySetInnerHTML={{ __html: getMiniMapWithZone() }}
                style={{ maxWidth: '100%', maxHeight: '280px', width: 'auto', height: 'auto' }}
              />
            </div>
          </div>

          <div className="w-3/5 flex flex-col">
            <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Статус охраны:</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${isDisabled ? 'text-gray-500' : 'text-gray-400'}`}>
                      🌿 Выкл
                    </span>
                    <button
                      onClick={handleToggleDisabled}
                      disabled={togglingProtection}
                      className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none shadow-md ${
                        isDisabled 
                          ? 'bg-gray-300' 
                          : 'bg-gradient-to-r from-red-500 to-red-600'
                      } ${togglingProtection ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                      title={isDisabled ? 'Включить охрану' : 'Выключить охрану'}
                    >
                      <span
                        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                          isDisabled ? 'translate-x-0' : 'translate-x-7'
                        }`}
                      />
                    </button>
                    <span className={`text-sm ${!isDisabled ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      🔴 Вкл
                    </span>
                  </div>
                </div>
              </div>
              {isDisabled && (
                <div className="mt-3 text-xs text-gray-500 bg-gray-100 p-2 rounded-lg text-center">
                  🌿 Охрана отключена вручную. Расписание не действует.
                </div>
              )}
              {!isDisabled && currentZoneType === 'red' && (
                <div className="mt-3 text-xs text-gray-500 bg-blue-50 p-2 rounded-lg text-center">
                  ⏰ Охрана работает по расписанию
                </div>
              )}
            </div>

            {canEditSchedule && (
              <div className="p-4 border-b border-gray-100">
                {!showAddForm ? (
                  <button
                    onClick={() => {
                      setEditingSchedule(null);
                      setShowAddForm(true);
                      setSelectedDay('Monday');
                      setStartTime('09:00');
                      setEndTime('18:00');
                    }}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2.5 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Добавить интервал
                  </button>
                ) : (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <h3 className="font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2">
                      <span>{editingSchedule ? '✏️' : '➕'}</span>
                      {editingSchedule ? 'Редактировать интервал' : 'Новый интервал'}
                    </h3>
                    <div className="space-y-3">
                      <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="self-center text-gray-400 text-sm">—</span>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={editingSchedule ? handleUpdateSchedule : handleAddSchedule}
                          disabled={submitting}
                          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 rounded-xl disabled:opacity-50 text-sm hover:from-green-600 hover:to-green-700 transition-all"
                        >
                          {submitting ? 'Сохранение...' : (editingSchedule ? 'Сохранить' : 'Добавить')}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddForm(false);
                            setEditingSchedule(null);
                          }}
                          className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-300 transition-all text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">💡 Интервалы не должны пересекаться</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-gray-400 text-sm">Загрузка...</div>
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-5xl mb-2">⏰</div>
                  <p className="text-sm">Нет интервалов</p>
                  {canEditSchedule && <p className="text-xs mt-1">Нажмите "Добавить интервал"</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {days.map(day => {
                    const daySchedules = getSchedulesForDay(day.value);
                    if (daySchedules.length === 0) return null;
                    
                    return (
                      <div key={day.value} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
                          {day.label}
                        </div>
                        <div className="divide-y divide-gray-50">
                          {daySchedules.map(schedule => {
                            return (
                              <div key={schedule.id} className="px-3 py-2 flex justify-between items-center hover:bg-gray-50 transition-all">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-xs text-blue-600">🕐</span>
                                  </div>
                                  <span className="font-mono text-sm text-gray-700">
                                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                  </span>
                                </div>
                                {canEditSchedule && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => editSchedule(schedule)}
                                      className="w-7 h-7 flex items-center justify-center text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-all"
                                      title="Редактировать"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(schedule.id)}
                                      className="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                      title="Удалить"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                )}
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
      </div>
    </div>
  );
};

export default ScheduleManager;