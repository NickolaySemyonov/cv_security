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
  onCancel: () => void;
  onSave: () => void;
  isAdmin: boolean;
  showAlert?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onZonesUpdate?: () => void;
}

export const ZoneManagementPanel: React.FC<ZoneManagementPanelProps> = ({
  zones,
  isSelectingZone,
  selectedCamerasCount,
  savingZone,
  editingZone,
  onCancel,
  onSave,
  isAdmin,
  showAlert,
  onZonesUpdate
}) => {
  const greenZones = zones.filter(z => !z.disabled && z.type === 'green').length;
  const redZones = zones.filter(z => !z.disabled && z.type === 'red').length;
  const disabledZones = zones.filter(z => z.disabled).length;

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-600/30 p-3 mb-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Индикаторы типов зон */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-400">
              Зелёная <span className="text-gray-500 ml-0.5">({greenZones})</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-gray-400">
              Красная <span className="text-gray-500 ml-0.5">({redZones})</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse-slow" />
            <span className="text-xs text-gray-400">
              Откл <span className="text-gray-500 ml-0.5">({disabledZones})</span>
            </span>
          </div>
        </div>

        {isAdmin && isSelectingZone && (
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <span className="text-xs text-blue-400 font-medium">
                Выбрано: {selectedCamerasCount}
              </span>
            </div>
            <button 
              onClick={onCancel} 
              className="px-3 py-1 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all duration-200 text-xs"
            >
              Отмена
            </button>
            <button 
              onClick={onSave} 
              disabled={savingZone || selectedCamerasCount === 0}
              className="px-3 py-1 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 disabled:opacity-50 transition-all duration-200 text-xs shadow-md"
            >
              {savingZone ? '...' : (editingZone ? 'Обновить' : 'Сохранить')}
            </button>
          </div>
        )}
      </div>

      {isSelectingZone && (
        <p className="text-xs text-blue-400 mt-2 pt-1 border-t border-gray-700/50 text-center">
          💡 Нажмите на камеру, чтобы добавить/удалить её из зоны
        </p>
      )}
    </div>
  );
};