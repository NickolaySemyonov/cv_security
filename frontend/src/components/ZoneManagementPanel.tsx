// components/ZoneManagementPanel.tsx
import React from 'react';

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

interface ZoneManagementPanelProps {
  zones: Zone[];
  isSelectingZone: boolean;
  selectedCamerasCount: number;
  savingZone: boolean;
  editingZone: Zone | null;
  showZonesList: boolean;
  onStartCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onToggleList: () => void;
  onEditZone: (zone: Zone) => void;
  onDeleteZone: (id: number) => void;
  onToggleType: (id: number) => void;
}

export const ZoneManagementPanel: React.FC<ZoneManagementPanelProps> = ({
  zones,
  isSelectingZone,
  selectedCamerasCount,
  savingZone,
  editingZone,
  showZonesList,
  onStartCreate,
  onCancel,
  onSave,
  onToggleList,
  onEditZone,
  onDeleteZone,
  onToggleType
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600">Зелёная зона</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-600">Красная зона</span>
          </div>
          {zones.length > 0 && (
            <button onClick={onToggleList} className="text-xs text-blue-600 hover:text-blue-800">
              {showZonesList ? 'Скрыть список' : `Показать зоны (${zones.length})`}
            </button>
          )}
        </div>
        
        {!isSelectingZone ? (
          <button 
            onClick={onStartCreate} 
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Выделить зону
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-600 font-medium">
              Выбрано камер: {selectedCamerasCount}
            </span>
            <button 
              onClick={onCancel} 
              className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Отмена
            </button>
            <button 
              onClick={onSave} 
              disabled={savingZone || selectedCamerasCount === 0}
              className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors text-sm"
            >
              {savingZone ? 'Сохранение...' : (editingZone ? 'Обновить зону' : 'Сохранить зону')}
            </button>
          </div>
        )}
      </div>

      {showZonesList && zones.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                  zone.type === 'red' 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${zone.type === 'red' ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-gray-700">
                  {zone.type === 'red' ? 'Красная' : 'Зелёная'} ({zone.cameras.length} {zone.cameras.length === 1 ? 'камера' : 'камер'})
                </span>
                <button 
                  onClick={() => onToggleType(zone.id)} 
                  className="text-xs text-blue-500 hover:text-blue-700 ml-1"
                  title={zone.type === 'red' ? 'Сделать зелёной' : 'Сделать красной'}
                >
                  🔄
                </button>
                <button 
                  onClick={() => onEditZone(zone)} 
                  className="text-xs text-yellow-500 hover:text-yellow-700"
                  title="Редактировать"
                >
                  ✏️
                </button>
                <button 
                  onClick={() => onDeleteZone(zone.id)} 
                  className="text-xs text-red-500 hover:text-red-700"
                  title="Удалить"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSelectingZone && (
        <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
          💡 Нажмите на зону видимости камеры или иконку камеры, чтобы добавить/удалить её из зоны
        </p>
      )}
    </div>
  );
};