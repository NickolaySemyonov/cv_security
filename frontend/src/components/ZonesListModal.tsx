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

interface ZonesListModalProps {
  zones: Zone[];
  onClose: () => void;
  onEditZone: (zone: Zone) => void;
  onDeleteZone: (id: number) => void;
  onOpenSchedule: (zone: Zone) => void;
  isAdmin: boolean;
  showAlert: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const ZonesListModal: React.FC<ZonesListModalProps> = ({
  zones,
  onClose,
  onEditZone,
  onDeleteZone,
  onOpenSchedule,
  isAdmin,
  showAlert
}) => {
  const handleOpenSchedule = (zone: Zone) => {
    onClose();
    onOpenSchedule(zone);
  };

  const handleEditClick = (zone: Zone) => {
    onClose();
    onEditZone(zone);
  };

  const handleDeleteClick = (zone: Zone) => {
    if (window.confirm(`Удалить зону "${zone.type === 'red' ? 'Красная зона' : 'Зелёная зона'}"?`)) {
      onDeleteZone(zone.id);
      showAlert('Зона успешно удалена', 'success');
    }
  };

  const getZoneDisplay = (zone: Zone) => {
    if (zone.disabled) {
      return { 
        label: '🌿 Охрана отключена', 
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-600',
        icon: '🌿'
      };
    }
    if (zone.type === 'red') {
      return { 
        label: 'Красная зона', 
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        icon: '🔴'
      };
    }
    return { 
      label: 'Зелёная зона', 
      bgClass: 'bg-green-50',
      textClass: 'text-green-700',
      icon: '🟢'
    };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-scaleIn">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Список зон</h2>
              <p className="text-sm text-gray-500">Всего зон: {zones.length}</p>
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

        <div className="flex-1 overflow-auto p-5">
          {zones.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-6xl mb-4">📭</div>
              <p>Нет добавленных зон</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => {
                const display = getZoneDisplay(zone);
                return (
                  <div
                    key={zone.id}
                    className={`${display.bgClass} rounded-xl p-4 border border-gray-100 transition-all hover:shadow-md`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{display.icon}</span>
                          <span className={`font-semibold ${display.textClass}`}>
                            {display.label}
                          </span>
                          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">
                            #{zone.id}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          📷 Камер в зоне: {zone.cameras.length}
                        </div>
                        {zone.cameras.length > 0 && (
                          <div className="text-xs text-gray-500 bg-white/50 p-2 rounded-lg">
                            Камеры: {zone.cameras.map(c => `#${c.id}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenSchedule(zone)}
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all"
                          title="Расписание охраны"
                        >
                          ⏰
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleEditClick(zone)}
                              className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-all"
                              title="Редактировать зону"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(zone)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                              title="Удалить зону"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Зелёная зона - охрана неактивна</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">Красная зона - охрана активна</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-gray-600">Охрана отключена вручную</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZonesListModal;