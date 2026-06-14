import React, { useState, useRef, useEffect } from 'react';
import { Zone } from '../types';

interface ZonesSidebarProps {
  zones: Zone[];
  onZoneClick: (zone: Zone) => void;
  onEditZone?: (zone: Zone) => void;
  onDeleteZone?: (zoneId: number) => void;
  onOpenSchedule?: (zone: Zone) => void;
  onStartSelectZone?: () => void;
  isSelectingZone?: boolean;
  isAdmin: boolean;
  showAlert?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const ZonesSidebar: React.FC<ZonesSidebarProps> = ({
  zones,
  onZoneClick,
  onEditZone,
  onDeleteZone,
  onOpenSchedule,
  onStartSelectZone,
  isSelectingZone = false,
  isAdmin,
  showAlert
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        const triggerButton = document.querySelector('.zones-sidebar-trigger');
        if (triggerButton && !triggerButton.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const getZoneColor = (zone: Zone) => {
    if (zone.disabled) return 'bg-gray-500';
    if (zone.type === 'red') return 'bg-red-500';
    return 'bg-green-500';
  };

  const getZoneBorderColor = (zone: Zone) => {
    if (zone.disabled) return 'border-l-gray-500';
    if (zone.type === 'red') return 'border-l-red-500';
    return 'border-l-green-500';
  };

  const handleZoneClick = (zone: Zone) => {
    onZoneClick(zone);
  };

  const handleEdit = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (onEditZone && isAdmin) {
      onEditZone(zone);
      setIsOpen(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (onDeleteZone && isAdmin) {
      onDeleteZone(zone.id);
      setIsOpen(false);
    }
  };

  const handleSchedule = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (onOpenSchedule) {
      onOpenSchedule(zone);
      setIsOpen(false);
    }
  };

  const handleStartSelectZone = () => {
    if (onStartSelectZone) {
      onStartSelectZone();
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`zones-sidebar-trigger fixed right-0 top-1/2 transform -translate-y-1/2 z-20
          flex items-center gap-2 px-3 py-4 rounded-l-xl shadow-lg transition-all duration-300
          ${isOpen ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
          border-l border-t border-b border-gray-600`}
        style={{ writingMode: 'vertical-rl' }}
        title="Список зон"
      >
        <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-sm font-medium">Зоны ({zones.length})</span>
      </button>

      <div
        ref={sidebarRef}
        className={`fixed right-0 top-0 h-full w-80 bg-gray-800/95 backdrop-blur-md shadow-2xl z-30
          transition-transform duration-300 ease-in-out border-l border-gray-700
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-200">Охраняемые зоны</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            title="Закрыть"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isAdmin && !isSelectingZone && (
          <div className="p-3 border-b border-gray-700">
            <button
              onClick={handleStartSelectZone}
              className="w-full bg-gray-700/60 hover:bg-gray-600/60 text-gray-300 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm border border-gray-600/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Выделить зону
            </button>
          </div>
        )}

        {isSelectingZone && (
          <div className="p-3 border-b border-gray-700 bg-blue-500/10">
            <p className="text-xs text-blue-400 text-center">
              🔵 Режим выделения зоны активен
            </p>
          </div>
        )}

        <div className="px-4 py-3 bg-gray-800/30 border-b border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Всего зон:</span>
            <span className="text-gray-200 font-semibold">{zones.length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-400">Активных зон:</span>
            <span className="text-green-400 font-semibold">{zones.filter(z => !z.disabled && z.type === 'green').length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-400">Охраняемых зон:</span>
            <span className="text-red-400 font-semibold">{zones.filter(z => !z.disabled && z.type === 'red').length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-400">Отключенных зон:</span>
            <span className="text-gray-400 font-semibold">{zones.filter(z => z.disabled).length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2 max-h-[calc(100vh-280px)]">
          {zones.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📭</div>
              <p>Нет добавленных зон</p>
              {isAdmin && <p className="text-xs mt-2">Нажмите "Выделить зону"</p>}
            </div>
          ) : (
            zones.map((zone) => (
              <div
                key={zone.id}
                onClick={() => handleZoneClick(zone)}
                className={`bg-gray-700/50 rounded-xl transition-all duration-200 hover:bg-gray-700 border-l-4 ${getZoneBorderColor(zone)} cursor-pointer hover:shadow-lg hover:shadow-blue-500/20`}
              >
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-lg ${zone.disabled ? 'text-gray-500' : (zone.type === 'red' ? 'text-red-500' : 'text-green-500')}`}>
                          {zone.disabled ? '🌿' : (zone.type === 'red' ? '🔴' : '🟢')}
                        </span>
                        <span className={`font-semibold text-sm ${zone.disabled ? 'text-gray-400' : 'text-gray-200'}`}>
                          Зона #{zone.id}
                        </span>
                        {zone.disabled && (
                          <span className="text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full animate-pulse">
                            Откл
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${zone.disabled ? 'text-gray-500' : 'text-gray-400'}`}>
                        📷 {zone.cameras.length} камер
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleSchedule(e, zone)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        zone.disabled 
                          ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-600' 
                          : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/20'
                      }`}
                      title="Расписание охраны"
                    >
                      ⏰
                    </button>
                    
                    {isAdmin && (
                      <>
                        <button
                          onClick={(e) => handleEdit(e, zone)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            zone.disabled 
                              ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-600' 
                              : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20'
                          }`}
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, zone)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            zone.disabled 
                              ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-600' 
                              : 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                          }`}
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="px-3 pb-3 pt-1">
                  <div className="text-xs text-blue-400 flex items-center gap-1">
                    <span>💡</span>
                    <span>Нажмите для подсветки</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-gray-400">Зелёная</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-gray-400">Красная</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse-slow"></div>
              <span className="text-gray-400">Откл</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ZonesSidebar;