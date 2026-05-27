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
}

const ZonesListModal: React.FC<ZonesListModalProps> = ({
  zones,
  onClose,
  onEditZone,
  onDeleteZone,
  onOpenSchedule,
  isAdmin
}) => {
  const handleOpenSchedule = (zone: Zone) => {
    onClose();
    onOpenSchedule(zone);
  };

  const handleEditClick = (zone: Zone) => {
    onClose();
    onEditZone(zone);
  };

  const getZoneDisplay = (zone: Zone) => {
    if (zone.disabled) {
      return { label: '🌿 Охрана отключена', className: 'bg-green-800 text-white' };
    }
    if (zone.type === 'red') {
      return { label: '🔴 Красная зона', className: 'bg-red-100 text-red-700' };
    }
    return { label: '🟢 Зелёная зона', className: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">📋 Список зон</h2>
            <p className="text-sm text-gray-500 mt-1">
              Всего зон: {zones.length}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {zones.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
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
                    className={`p-4 rounded-xl border ${
                      zone.disabled 
                        ? 'bg-green-50 border-green-200' 
                        : (zone.type === 'red' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-3 h-3 rounded-full ${
                            zone.disabled 
                              ? 'bg-green-800' 
                              : (zone.type === 'red' ? 'bg-red-500' : 'bg-green-500')
                          }`} />
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${display.className}`}>
                            {display.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            #{zone.id}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          📷 Камер в зоне: {zone.cameras.length}
                        </div>
                        {zone.cameras.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            Камеры: {zone.cameras.map(c => `#${c.id}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenSchedule(zone)}
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Расписание охраны"
                        >
                          ⏰
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleEditClick(zone)}
                              className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Редактировать зону"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onDeleteZone(zone.id)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
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

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            🟢 Зелёная зона - охрана неактивна | 🔴 Красная зона - охрана активна | 🌿 Охрана отключена вручную
          </p>
        </div>
      </div>
    </div>
  );
};

export default ZonesListModal;