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
  disabled: boolean;
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
  onStartCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenZonesList: () => void;
  isAdmin: boolean;
}

export const ZoneManagementPanel: React.FC<ZoneManagementPanelProps> = ({
  zones,
  isSelectingZone,
  selectedCamerasCount,
  savingZone,
  editingZone,
  onStartCreate,
  onCancel,
  onSave,
  onOpenZonesList,
  isAdmin
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
            <button 
              onClick={onOpenZonesList}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200 transition-colors"
            >
              📋 Показать зоны ({zones.length})
            </button>
          )}
        </div>
        
        {/* Кнопка "Выделить зону" - только для админа */}
        {isAdmin && !isSelectingZone && (
          <button 
            onClick={onStartCreate} 
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Выделить зону
          </button>
        )}

        {/* Режим выделения зоны - только для админа */}
        {isAdmin && isSelectingZone && (
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

      {isSelectingZone && (
        <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
          💡 Нажмите на зону видимости камеры или иконку камеры, чтобы добавить/удалить её из зоны
        </p>
      )}
    </div>
  );
};