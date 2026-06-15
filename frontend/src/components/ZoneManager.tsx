import { useState, useEffect } from 'react';
import api from '../config/axios';

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

interface ZoneManagerProps {
  floorId: number;
  floorMap: string;
  cameras: Camera[];
  onZonesUpdate: () => void;
}

const ZoneManager = ({ floorId, floorMap, cameras, onZonesUpdate }: ZoneManagerProps) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isSelectingZone, setIsSelectingZone] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchZones();
  }, [floorId]);

  const fetchZones = async () => {
    try {
      const response = await api.get(`/areas/floor/${floorId}`);
      setZones(response.data);
    } catch (error) {
      console.error('Ошибка загрузки зон:', error);
    }
  };

  const startCreateZone = () => {
    setIsSelectingZone(true);
    setSelectedCameras(new Set());
    setEditingZone(null);
  };

  const cancelCreateZone = () => {
    setIsSelectingZone(false);
    setSelectedCameras(new Set());
    setEditingZone(null);
  };

  const toggleCameraSelection = (cameraId: number) => {
    const newSelected = new Set(selectedCameras);
    if (newSelected.has(cameraId)) {
      newSelected.delete(cameraId);
    } else {
      newSelected.add(cameraId);
    }
    setSelectedCameras(newSelected);
  };

  const saveZone = async () => {
    if (selectedCameras.size === 0) {
      alert('Выберите хотя бы одну камеру для зоны');
      return;
    }

    setLoading(true);
    try {
      if (editingZone) {
        await api.patch(`/areas/${editingZone.id}`, {
          camera_ids: Array.from(selectedCameras)
        });
      } else {
        await api.post('/areas/', {
          type: 'green',
          floor_id: floorId,
          camera_ids: Array.from(selectedCameras)
        });
      }
      
      await fetchZones();
      onZonesUpdate();
      cancelCreateZone();
    } catch (error) {
      console.error('Ошибка сохранения зоны:', error);
      alert('Ошибка при сохранении зоны');
    } finally {
      setLoading(false);
    }
  };

  const editZone = (zone: Zone) => {
    setEditingZone(zone);
    setSelectedCameras(new Set(zone.cameras.map(c => c.id)));
    setIsSelectingZone(true);
  };

  const deleteZone = async (zoneId: number) => {
    try {
      await api.delete(`/areas/${zoneId}`);
      await fetchZones();
      onZonesUpdate();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Ошибка удаления зоны:', error);
      alert('Ошибка при удалении зоны');
    }
  };

  const toggleZoneType = async (zoneId: number, currentType: string) => {
    try {
      await api.post(`/areas/${zoneId}/toggle-type`);
      await fetchZones();
      onZonesUpdate();
    } catch (error) {
      console.error('Ошибка изменения типа зоны:', error);
    }
  };

  const getSvgWithZones = (): string => {
    if (!floorMap) return '';
    
    let modifiedSvg = floorMap;
    
    zones.forEach((zone) => {
      const color = zone.type === 'red' 
        ? 'rgba(255, 100, 100, 0.3)' 
        : 'rgba(100, 255, 100, 0.3)';
      const strokeColor = zone.type === 'red' ? '#FF4444' : '#44FF44';
      
      zone.cameras.forEach((camera) => {
        if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
          const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
          const polygon = `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="3" stroke-dasharray="6,4" />`;
          modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
        }
      });
    });
    
    if (isSelectingZone) {
      cameras.forEach((camera) => {
        if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
          const isSelected = selectedCameras.has(camera.id);
          const fillColor = isSelected ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 255, 0, 0.2)';
          const strokeColor = isSelected ? '#00FFFF' : '#FFAA00';
          const strokeWidth = isSelected ? '4' : '2';
          
          const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
          const polygon = `<polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="6,4" cursor="pointer" data-camera-id="${camera.id}" class="selectable-zone" />`;
          modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
        }
      });
    }
    
    return modifiedSvg;
  };

  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingZone) return;
    
    const target = e.target as HTMLElement;
    const polygon = target.closest('.selectable-zone');
    
    if (polygon) {
      const cameraId = parseInt(polygon.getAttribute('data-camera-id') || '0');
      if (cameraId) {
        toggleCameraSelection(cameraId);
      }
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">🎯 Охраняемые зоны</h3>
          <p className="text-sm text-gray-500">Группируйте камеры в зоны для мониторинга</p>
        </div>
        
        {!isSelectingZone && (
          <button
            onClick={startCreateZone}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Выделить зону
          </button>
        )}
      </div>

      {isSelectingZone && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-800 font-medium">
                {editingZone ? '✏️ Редактирование зоны' : '➕ Создание новой зоны'}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Выбрано камер: {selectedCameras.size}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelCreateZone}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Отмена
              </button>
              <button
                onClick={saveZone}
                disabled={loading || selectedCameras.size === 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Сохранение...' : (editingZone ? 'Обновить зону' : 'Сохранить зону')}
              </button>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
            💡 Нажмите на зону видимости камеры, чтобы добавить/удалить её из зоны
          </p>
        </div>
      )}

      <div 
        className="border rounded-lg p-2 bg-gray-50 overflow-auto"
        style={{ minHeight: '400px', maxHeight: '500px' }}
        onClick={handleSvgClick}
      >
        <div 
          dangerouslySetInnerHTML={{ __html: getSvgWithZones() }}
          className="inline-block"
        />
      </div>

      {zones.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-gray-700">Существующие зоны:</h4>
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`p-3 rounded-lg border ${
                zone.type === 'red' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${zone.type === 'red' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div>
                    <span className="font-medium">
                      {zone.type === 'red' ? '🔴 Красная зона' : '🟢 Зелёная зона'}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      {zone.cameras.length} {zone.cameras.length === 1 ? 'камера' : 'камер'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleZoneType(zone.id, zone.type)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {zone.type === 'red' ? '🟢 Сделать зелёной' : '🔴 Сделать красной'}
                  </button>
                  <button
                    onClick={() => editZone(zone)}
                    className="text-sm text-yellow-600 hover:text-yellow-800"
                  >
                    ✏️ Редактировать
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(zone.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </div>
              
              {showDeleteConfirm === zone.id && (
                <div className="mt-2 p-2 bg-white rounded border border-red-200">
                  <p className="text-sm text-red-600 mb-2">Удалить эту зону?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteZone(zone.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      Да, удалить
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ZoneManager;