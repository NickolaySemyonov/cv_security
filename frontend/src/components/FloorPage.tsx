import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import { ZoneManagementPanel } from './ZoneManagementPanel';
import ScheduleManager from './ScheduleManager';
import ZonesListModal from './ZonesListModal';
import HomographyCalibration from './HomographyCalibration';
import CameraStreamModal from './CameraStreamModal';
import FloorNavigation from './floor/FloorNavigation';
import ZonesSidebar from './ZonesSidebar';
import FloorOverlay from './FloorOverlay';
import ConfirmModal from './ConfirmModal';
import { useSvgRenderer } from '../hooks/useSvgRenderer';
import { useWebSocket, Notification } from '../hooks/useWebSocket';
import { useAlert } from './CustomAlert';
import { useConfirm } from '../hooks/useConfirm';
import { Floor, User, Camera, Zone } from '../types';

const FloorPage = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const { place } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const decodedPlace = decodeURIComponent(place || '');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blinkingZonesRef = useRef<Set<number>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { showAlert, AlertComponent } = useAlert();
  const { confirm, isOpen: confirmOpen, options, handleConfirm, handleCancel } = useConfirm();

  const [floors, setFloors] = useState<Floor[]>([]);
  const [currentFloor, setCurrentFloor] = useState<Floor | null>(null);
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [floorCameraIds, setFloorCameraIds] = useState<number[]>([]);
  const [blinkingAreaId, setBlinkingAreaId] = useState<number | null>(null);
  const [forceRender, setForceRender] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [blinkingZones, setBlinkingZones] = useState<Set<number>>(new Set());
  const [highlightedZoneId, setHighlightedZoneId] = useState<number | null>(null);
  const [highlightIntensity, setHighlightIntensity] = useState(0);
  const [lastZoneUpdate, setLastZoneUpdate] = useState<Date | null>(null);
  const zonesRef = useRef<Zone[]>([]);

  const [isSelectingZone, setIsSelectingZone] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<number>>(new Set());
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [scheduleArea, setScheduleArea] = useState<Zone | null>(null);
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [showHomographyCalibration, setShowHomographyCalibration] = useState(false);
  const [selectedCameraForCalibration, setSelectedCameraForCalibration] = useState<Camera | null>(null);
  const [selectedStreamCamera, setSelectedStreamCamera] = useState<{ id: number; url: string } | null>(null);

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';

  const calibratedCameras = useMemo(() => cameras.filter(c => c.is_configured === true), [cameras]);

  const { detections, notifications, getDetectionsByFloor, registerFloorCameras, clearDetections } = useWebSocket();
  const { getCleanSvg, getOverlayData } = useSvgRenderer(
    calibratedCameras, zones, isSelectingZone, selectedCameras, editingZone,
    getDetectionsByFloor, currentFloor?.id || 0, blinkingAreaId, isAdmin
  );

  const highlightZone = useCallback((zoneId: number) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    setHighlightedZoneId(zoneId);
    setHighlightIntensity(1);
    
    const startTime = Date.now();
    const duration = 5000;
    
    const updateIntensity = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setHighlightIntensity(remaining);
      
      if (remaining > 0) {
        highlightTimeoutRef.current = setTimeout(updateIntensity, 50);
      } else {
        setHighlightedZoneId(null);
        highlightTimeoutRef.current = null;
      }
    };
    
    highlightTimeoutRef.current = setTimeout(updateIntensity, 50);
  }, []);

  const fetchZones = useCallback(async () => {
    if (!currentFloor?.id) {
      return;
    }
    
    try { 
      const response = await api.get(`/areas/floor/${currentFloor.id}`);
      const newZones = response.data;
      
      const oldZonesStr = JSON.stringify(zonesRef.current.map(z => ({ id: z.id, type: z.type, disabled: z.disabled })));
      const newZonesStr = JSON.stringify(newZones.map((z: Zone) => ({ id: z.id, type: z.type, disabled: z.disabled })));
      
      if (oldZonesStr !== newZonesStr) {
        zonesRef.current = newZones;
        setZones(newZones);
        setLastZoneUpdate(new Date());
        setForceRender(prev => prev + 1);
      }
    } catch (err) { 
      console.error('❌ Ошибка загрузки зон:', err); 
    }
  }, [currentFloor?.id]);

  // Периодический опрос зон каждую секунду
  useEffect(() => {
    if (!currentFloor?.id) return;
    
    
    fetchZones();
    
    intervalRef.current = setInterval(() => {
      fetchZones();
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentFloor?.id, fetchZones]);

  useEffect(() => {
    const activeNotifications = notifications.filter((n: Notification) => !n.isRead);
    const newZonesWithAlerts = new Set<number>();
    
    activeNotifications.forEach((notification: Notification) => {
      const camera = calibratedCameras.find(c => c.id === notification.camera_id);
      if (camera) {
        const zone = zones.find(z => z.cameras.some(cam => cam.id === camera.id));
        if (zone && zone.type === 'red') {
          newZonesWithAlerts.add(zone.id);
        }
      }
    });
    
    let hasChanged = false;
    if (blinkingZonesRef.current.size !== newZonesWithAlerts.size) {
      hasChanged = true;
    } else {
      for (const id of newZonesWithAlerts) {
        if (!blinkingZonesRef.current.has(id)) {
          hasChanged = true;
          break;
        }
      }
    }
    
    if (hasChanged) {
      blinkingZonesRef.current = newZonesWithAlerts;
      setBlinkingZones(new Set(newZonesWithAlerts));
    }
  }, [notifications, calibratedCameras, zones]);

  useEffect(() => {
    fetchFloors();
  }, [decodedPlace]);

  useEffect(() => {
    if (floors.length > 0 && !initialized) {
      const floorFromUrl = new URLSearchParams(location.search).get('floor');
      const target = floors.find(f => f.number === Number(floorFromUrl)) || floors[0];
      setCurrentFloor(target);
      setSelectedFloorNumber(target.number);
      navigate(`/objects/${encodeURIComponent(decodedPlace)}/floors?floor=${target.number}`, { replace: true });
      setInitialized(true);
    }
  }, [floors, location.search, navigate, decodedPlace]);

  useEffect(() => {
    if (currentFloor?.id) {
      clearDetections();
      fetchCameraIds();
      fetchCameras();
      fetchZones();
    }
  }, [currentFloor?.id]);

  useEffect(() => {
    if (currentFloor?.id && floorCameraIds.length) {
      registerFloorCameras(currentFloor.id, calibratedCameras.map(c => c.id));
    }
  }, [currentFloor?.id, floorCameraIds, calibratedCameras]);

  useEffect(() => {
    if (blinkingAreaId) {
      setForceRender(prev => prev + 1);
      const timeout = setTimeout(() => {
        setBlinkingAreaId(null);
        setForceRender(prev => prev + 1);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [blinkingAreaId]);

  const fetchFloors = async () => {
    try {
      const res = await api.get('/floors/');
      setFloors(res.data.filter((f: Floor) => f.place === decodedPlace));
    } catch (err) { 
      setError('Не удалось загрузить этажи'); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchCameras = async () => {
    if (!currentFloor?.id) return;
    try { 
      setCameras((await api.get(`/cameras/floor/${currentFloor.id}`)).data); 
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchCameraIds = async () => {
    if (!currentFloor?.id) return;
    try { 
      setFloorCameraIds((await api.get(`/cameras/floor/${currentFloor.id}/ids`)).data); 
    } catch (err) { 
      setFloorCameraIds([]); 
    }
  };

  const refreshData = async () => {
    await Promise.all([fetchZones(), fetchCameras(), fetchCameraIds()]);
    setForceRender(prev => prev + 1);
  };

  const handleFloorChange = (floorNumber: number) => {
    const floor = floors.find(f => f.number === floorNumber);
    if (floor) setCurrentFloor(floor);
    setSelectedFloorNumber(floorNumber);
    navigate(`/objects/${encodeURIComponent(decodedPlace)}/floors?floor=${floorNumber}`, { replace: true });
    setIsSelectingZone(false);
    setSelectedCameras(new Set());
    setEditingZone(null);
    clearDetections();
  };

  const handlePrevFloor = () => {
    const sorted = [...floors].sort((a, b) => a.number - b.number);
    const idx = sorted.findIndex(f => f.number === selectedFloorNumber);
    if (idx > 0) handleFloorChange(sorted[idx - 1].number);
  };

  const handleNextFloor = () => {
    const sorted = [...floors].sort((a, b) => a.number - b.number);
    const idx = sorted.findIndex(f => f.number === selectedFloorNumber);
    if (idx < sorted.length - 1) handleFloorChange(sorted[idx + 1].number);
  };

  const handleDeleteFloor = async () => {
    if (!currentFloor) return;
    
    const confirmed = await confirm({
      title: 'Удаление этажа',
      message: `Удалить этаж ${currentFloor.number}? Все камеры и зоны будут удалены. Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/floors/${currentFloor.id}`);
      showAlert('Этаж удалён', 'success');
      setTimeout(() => window.location.href = '/objects', 1000);
    } catch (err: any) { 
      showAlert(err.response?.data?.detail || 'Ошибка удаления', 'error'); 
    }
  };

  const handleBack = () => window.location.href = '/objects';
  const handleOpenSchedule = (zone: Zone) => setScheduleArea(zone);
  
  const handleZoneClick = (zoneId: number) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone) {
      setScheduleArea(zone);
    }
  };

  const handleOpenCamerasPage = useCallback(() => {
    if (currentFloor?.id) {
      navigate(`/floors/${currentFloor.id}/cameras`);
    } else {
      showAlert('Ошибка: этаж не выбран', 'error');
    }
  }, [currentFloor?.id, navigate, showAlert]);

  const handleZoneClickSidebar = useCallback((zone: Zone) => {
    highlightZone(zone.id);
    
    if (zone.cameras.length > 0 && zone.cameras[0].position) {
      const container = mapContainerRef.current;
      if (container) {
        const firstCamera = zone.cameras[0];
        const svg = container.querySelector('svg');
        if (svg && firstCamera.position) {
          const viewBox = svg.getAttribute('viewBox');
          if (viewBox) {
            const [x, y, width, height] = viewBox.split(' ').map(Number);
            const targetX = firstCamera.position.x - width / 2;
            const targetY = firstCamera.position.y - height / 2;
            container.scrollTo({
              left: Math.max(0, targetX),
              top: Math.max(0, targetY),
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [highlightZone]);

  const handleEditZoneFromSidebar = useCallback((zone: Zone) => {
    setEditingZone(zone);
    setSelectedCameras(new Set(zone.cameras.map(c => c.id)));
    setIsSelectingZone(true);
    setForceRender(prev => prev + 1);
    showAlert(`Редактирование зоны #${zone.id}`, 'info');
  }, [showAlert]);

  const handleDeleteZoneFromSidebar = useCallback(async (zoneId: number) => {
    const confirmed = await confirm({
      title: 'Удаление зоны',
      message: `Удалить зону #${zoneId}? Все камеры в зоне останутся без изменений.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/areas/${zoneId}`);
      await refreshData();
      showAlert('Зона удалена', 'success');
    } catch (err) { 
      showAlert('Ошибка удаления', 'error'); 
    }
  }, [showAlert, confirm, refreshData]);

  const handleOpenScheduleFromSidebar = useCallback((zone: Zone) => {
    setScheduleArea(zone);
  }, []);

  const isCameraInAnyZone = (id: number) => zones.some(z => z.cameras.some(c => c.id === id));
  const getZoneOfCamera = (id: number) => zones.find(z => z.cameras.some(c => c.id === id)) || null;

  const toggleCameraSelection = useCallback((cameraId: number) => {
    const inZone = isCameraInAnyZone(cameraId);
    const cameraZone = getZoneOfCamera(cameraId);

    if (editingZone) {
      if (inZone && cameraZone?.id !== editingZone.id) {
        showAlert(`⚠️ Камера уже в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!`, 'warning');
        return;
      }
      setSelectedCameras(prev => {
        const newSet = new Set(prev);
        newSet.has(cameraId) ? newSet.delete(cameraId) : newSet.add(cameraId);
        return newSet;
      });
      setForceRender(prev => prev + 1);
      return;
    }

    if (inZone) {
      showAlert(`⚠️ Камера уже в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!`, 'warning');
      return;
    }
    setSelectedCameras(prev => {
      const newSet = new Set(prev);
      newSet.has(cameraId) ? newSet.delete(cameraId) : newSet.add(cameraId);
      return newSet;
    });
    setForceRender(prev => prev + 1);
  }, [editingZone, showAlert]);

 const saveZone = useCallback(async () => {
  if (!selectedCameras.size) { 
    showAlert('Выберите камеры для зоны', 'warning'); 
    return; 
  }
  if (!editingZone) {
    const inOther = Array.from(selectedCameras).filter(isCameraInAnyZone);
    if (inOther.length) { 
      showAlert('❌ Некоторые камеры уже в других зонах', 'error'); 
      return; 
    }
  }

  setSavingZone(true);
  try {
    if (editingZone) {
      await api.patch(`/areas/${editingZone.id}`, { camera_ids: Array.from(selectedCameras) });
      showAlert('Зона обновлена', 'success');
    } else {
      await api.post('/areas/', { type: 'green', floor_id: currentFloor!.id, camera_ids: Array.from(selectedCameras) });
      showAlert('Зона создана', 'success');
    }
  
    setTimeout(() => {
      window.location.reload();
    }, 500);
    
  } catch (err: any) { 
    console.error('Ошибка сохранения зоны:', err);
    showAlert(err.response?.data?.detail || 'Ошибка', 'error'); 
  } finally { 
    setSavingZone(false); 
  }
}, [selectedCameras, editingZone, currentFloor, showAlert]);


  const deleteZone = useCallback(async (zoneId: number) => {
    const confirmed = await confirm({
      title: 'Удаление зоны',
      message: `Удалить зону #${zoneId}?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/areas/${zoneId}`);
      await refreshData();
      await fetchZones();
      showAlert('Зона удалена', 'success');
    } catch (err) { 
      showAlert('Ошибка удаления', 'error'); 
    }
  }, [showAlert, confirm, refreshData, fetchZones]);

  const handleCameraClick = useCallback((cameraId: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return;
    if (isAdmin) {
      setSelectedCameraForCalibration(camera);
      setShowHomographyCalibration(true);
    } else if (isOperator) {
      setSelectedStreamCamera({ id: cameraId, url: camera.video_stream || `http://localhost:8888/camera_${cameraId}/index.m3u8` });
    }
  }, [cameras, isAdmin, isOperator]);

  const normalizeSvg = (svg: string) => {
    if (!svg) return '';
    if (!/viewBox=["']/.test(svg)) {
      const w = svg.match(/width=["']([0-9.]+)/)?.[1] || '800';
      const h = svg.match(/height=["']([0-9.]+)/)?.[1] || '600';
      svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
    }
    return svg;
  };

  const overlayData = getOverlayData();
  const hasConfiguredCameras = calibratedCameras.length > 0;
  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);
  const currentIndex = sortedFloors.findIndex(f => f.number === selectedFloorNumber);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < sortedFloors.length - 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
        <Header user={user} onLogout={onLogout} title={decodedPlace} onAreaBlink={setBlinkingAreaId} />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-400">Загрузка этажей...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !currentFloor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
        <Header user={user} onLogout={onLogout} title={decodedPlace} onAreaBlink={setBlinkingAreaId} />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-red-400">{error || 'Этаж не найден'}</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
      {AlertComponent}
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
      <Header user={user} onLogout={onLogout} title={decodedPlace} onAreaBlink={setBlinkingAreaId} />
      <main className="max-w-7xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-4 mb-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm">Назад</span>
              </button>
            </div>
            
            <div className="flex-1 flex justify-center">
              <FloorNavigation
                floors={floors}
                selectedFloorNumber={selectedFloorNumber}
                onFloorChange={handleFloorChange}
                onPrevFloor={handlePrevFloor}
                onNextFloor={handleNextFloor}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            </div>
            
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button onClick={handleDeleteFloor} className="text-red-400 hover:text-red-300" title="Удалить этаж">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {isAdmin && hasConfiguredCameras && (
          <ZoneManagementPanel
            zones={zones}
            isSelectingZone={isSelectingZone}
            selectedCamerasCount={selectedCameras.size}
            savingZone={savingZone}
            editingZone={editingZone}
            onCancel={() => {
              setIsSelectingZone(false);
              setSelectedCameras(new Set());
              setEditingZone(null);
              setForceRender(prev => prev + 1);
            }}
            onSave={saveZone}
            isAdmin={isAdmin}
            showAlert={showAlert}
            onZonesUpdate={refreshData}
          />
        )}

        <ZonesSidebar
          zones={zones}
          onZoneClick={handleZoneClickSidebar}
          onEditZone={isAdmin ? handleEditZoneFromSidebar : undefined}
          onDeleteZone={isAdmin ? handleDeleteZoneFromSidebar : undefined}
          onOpenSchedule={handleOpenScheduleFromSidebar}
          onStartSelectZone={() => {
            setIsSelectingZone(true);
            setSelectedCameras(new Set());
            setEditingZone(null);
            setForceRender(prev => prev + 1);
          }}
          isSelectingZone={isSelectingZone}
          isAdmin={isAdmin}
          showAlert={showAlert}
        />

        {isAdmin && currentFloor?.id && (
          <button
            onClick={handleOpenCamerasPage}
            className="fixed right-0 top-1/3 transform -translate-y-1/2 z-20
              flex items-center gap-2 px-3 py-4 rounded-l-xl shadow-lg transition-all duration-300
              bg-gray-800 text-gray-300 hover:bg-gray-700
              border-l border-t border-b border-gray-600"
            style={{ writingMode: 'vertical-rl' }}
            title="Управление камерами"
          >
            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Камеры</span>
          </button>
        )}

        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-600/50">
            <h2 className="text-lg font-semibold text-gray-200">{decodedPlace} - Этаж {currentFloor.number}</h2>
          </div>
          
          <div 
            ref={mapContainerRef}
            className="p-4 bg-gray-900/30 flex justify-center relative w-full"
          >
            <div 
              dangerouslySetInnerHTML={{ __html: getCleanSvg(normalizeSvg(currentFloor.map)) }} 
              style={{ width: '100%', height: 'auto' }}
            />
            <FloorOverlay
              svgContainerRef={mapContainerRef}
              zones={overlayData.zones}
              cameras={overlayData.cameras}
              detections={overlayData.detections}
              isSelectingZone={isSelectingZone}
              blinkingZones={blinkingZones}
              highlightedZoneId={highlightedZoneId}
              highlightIntensity={highlightIntensity}
              isAdmin={isAdmin}
              onZoneClick={handleZoneClick}
              onCameraClick={handleCameraClick}
              onSelectableClick={toggleCameraSelection}
            />
          </div>
        </div>
      </main>
      <Footer />

      {scheduleArea && (
        <ScheduleManager
          areaId={scheduleArea.id}
          areaName={scheduleArea.type === 'red' ? 'Красная зона' : 'Зелёная зона'}
          areaType={scheduleArea.type}
          areaDisabled={scheduleArea.disabled}
          floorMap={currentFloor.map}
          zoneCameras={scheduleArea.cameras}
          onClose={() => setScheduleArea(null)}
          onScheduleChange={refreshData}
          onZoneTypeChange={refreshData}
          onBackToList={() => {
            setScheduleArea(null);
            setShowZonesModal(true);
          }}
          isAdmin={isAdmin}
          showAlert={showAlert}
        />
      )}

      {showZonesModal && (
        <ZonesListModal
          zones={zones}
          onClose={() => setShowZonesModal(false)}
          onEditZone={(zone) => {
            setEditingZone(zone);
            setSelectedCameras(new Set(zone.cameras.map(c => c.id)));
            setIsSelectingZone(true);
            setShowZonesModal(false);
            setForceRender(prev => prev + 1);
          }}
          onDeleteZone={deleteZone}
          onOpenSchedule={handleOpenSchedule}
          isAdmin={isAdmin}
          showAlert={showAlert}
        />
      )}

      {showHomographyCalibration && selectedCameraForCalibration && isAdmin && (
        <HomographyCalibration
          cameraId={selectedCameraForCalibration.id}
          cameraZone={selectedCameraForCalibration.visible_zone.vertices}
          cameraPosition={selectedCameraForCalibration.position}
          svgContent={currentFloor.map}
          onSave={() => {
            setShowHomographyCalibration(false);
            fetchCameras();
            showAlert('Калибровка сохранена', 'success');
          }}
          onCancel={() => setShowHomographyCalibration(false)}
          isReCalibration={selectedCameraForCalibration.is_configured || false}
        />
      )}

      {selectedStreamCamera && (
        <CameraStreamModal
          cameraId={selectedStreamCamera.id}
          streamUrl={selectedStreamCamera.url}
          floorMap={currentFloor?.map}
          cameraZone={cameras.find(c => c.id === selectedStreamCamera.id)?.visible_zone?.vertices}
          cameraPosition={cameras.find(c => c.id === selectedStreamCamera.id)?.position}
          onClose={() => setSelectedStreamCamera(null)}
        />
      )}
    </div>
  );
};

export default FloorPage;