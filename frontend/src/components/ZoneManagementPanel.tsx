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
  onStartCreate,
  onCancel,
  onSave,
  isAdmin,
  showAlert,
  onZonesUpdate
}) => {
  return (
    <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-4 mb-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-300">Зелёная зона</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-gray-300">Красная зона</span>
          </div>
          {zones.length > 0 && (
            <div className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Всего зон: {zones.length}
            </div>
          )}
        </div>
        
        {isAdmin && !isSelectingZone && (
          <button 
            onClick={onStartCreate} 
            className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-4 py-2 rounded-xl hover:from-purple-700 hover:to-purple-600 transition-all duration-200 flex items-center gap-2 text-sm shadow-lg shadow-purple-500/25"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Выделить зону
          </button>
        )}

        {isAdmin && isSelectingZone && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <span className="text-sm text-blue-400 font-medium">
                Выбрано камер: {selectedCamerasCount}
              </span>
            </div>
            <button 
              onClick={onCancel} 
              className="px-4 py-1.5 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all duration-200 text-sm"
            >
              Отмена
            </button>
            <button 
              onClick={onSave} 
              disabled={savingZone || selectedCamerasCount === 0}
              className="px-4 py-1.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:from-green-700 hover:to-green-600 disabled:opacity-50 transition-all duration-200 text-sm shadow-lg shadow-green-500/25"
            >
              {savingZone ? 'Сохранение...' : (editingZone ? 'Обновить зону' : 'Сохранить зону')}
            </button>
          </div>
        )}
      </div>

      {isSelectingZone && (
        <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-700">
          💡 Нажмите на зону видимости камеры или иконку камеры, чтобы добавить/удалить её из зоны
        </p>
      )}
    </div>
  );
};