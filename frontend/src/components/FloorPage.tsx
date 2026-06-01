import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import { ZoneManagementPanel } from './ZoneManagementPanel';
import ScheduleManager from './ScheduleManager';
import ZonesListModal from './ZonesListModal';
import HomographyCalibration from './HomographyCalibration';
import { useSvgRenderer } from '../hooks/useSvgRenderer';
import { useCameraDetection } from '../hooks/useCameraDetection';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface User {
  id: number;
  login: string;
  role: string;
}

interface Camera {
  id: number;
  floor_id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_active: boolean;
  is_configured?: boolean;
  rotation?: number;
}

interface Zone {
  id: number;
  type: string;
  disabled: boolean;
  red_zone: boolean;
  floor_id: number;
  cameras: Camera[];
}

interface FloorPageProps {
  user: User | null;
  onLogout: () => void;
}

const FloorPage = ({ user, onLogout }: FloorPageProps) => {
  const { place } = useParams<{ place: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const decodedPlace = decodeURIComponent(place || '');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [floors, setFloors] = useState<Floor[]>([]);
  const [currentFloor, setCurrentFloor] = useState<Floor | null>(null);
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [floorCameraIds, setFloorCameraIds] = useState<number[]>([]);
  const [blinkingZoneId, setBlinkingZoneId] = useState<number | null>(null);
  
  const [isSelectingZone, setIsSelectingZone] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<number>>(new Set());
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [scheduleArea, setScheduleArea] = useState<Zone | null>(null);
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [showHomographyCalibration, setShowHomographyCalibration] = useState(false);
  const [selectedCameraForCalibration, setSelectedCameraForCalibration] = useState<Camera | null>(null);

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';

  const { detections, getDetectionsByFloor, registerFloorCameras, clearDetections, isConnected } = useCameraDetection();
  const { getSvgWithAllElements } = useSvgRenderer(
    cameras, zones, isSelectingZone, selectedCameras, editingZone, 
    getDetectionsByFloor, currentFloor?.id || 0,
    blinkingZoneId,
    isAdmin
  );

  const getFloorFromUrl = () => {
    const params = new URLSearchParams(location.search);
    const floorParam = params.get('floor');
    return floorParam ? parseInt(floorParam, 10) : null;
  };

  useEffect(() => {
    fetchFloors();
  }, [decodedPlace]);

  useEffect(() => {
    if (floors.length > 0 && !initialized) {
      const floorFromUrl = getFloorFromUrl();
      let targetFloor: Floor | undefined;
      
      if (floorFromUrl) {
        targetFloor = floors.find(f => f.number === floorFromUrl);
      }
      
      if (targetFloor) {
        setCurrentFloor(targetFloor);
        setSelectedFloorNumber(targetFloor.number);
      } else if (floors.length > 0) {
        setCurrentFloor(floors[0]);
        setSelectedFloorNumber(floors[0].number);
        navigate(`/objects/${encodeURIComponent(decodedPlace)}/floors?floor=${floors[0].number}`, { replace: true });
      }
      setInitialized(true);
    }
  }, [floors, location.search, initialized, navigate, decodedPlace]);

  useEffect(() => {
    if (currentFloor?.id) {
      clearDetections();
      fetchCameraIds();
      fetchCameras();
      fetchZones();
    }
  }, [currentFloor?.id]);

  useEffect(() => {
    if (currentFloor?.id && floorCameraIds.length > 0) {
      const configuredIds = cameras.filter(c => c.is_configured === true).map(c => c.id);
      registerFloorCameras(currentFloor.id, configuredIds);
    } else if (currentFloor?.id && floorCameraIds.length === 0) {
      registerFloorCameras(currentFloor.id, []);
    }
  }, [currentFloor?.id, floorCameraIds, cameras]);

  useEffect(() => {
    const checkCamerasUpdate = () => {
      const camerasUpdated = sessionStorage.getItem('camerasUpdated');
      if (camerasUpdated) {
        sessionStorage.removeItem('camerasUpdated');
        if (currentFloor?.id) {
          fetchCameraIds();
          fetchCameras();
          fetchZones();
          setUpdateTrigger(prev => prev + 1);
        }
      }
    };
    
    checkCamerasUpdate();
    
    const handleFocus = () => {
      if (currentFloor?.id) {
        fetchCameraIds();
        fetchCameras();
        fetchZones();
        setUpdateTrigger(prev => prev + 1);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentFloor?.id]);

  const fetchFloors = async () => {
    try {
      setLoading(true);
      const response = await api.get<Floor[]>('/floors');
      const objectFloors = response.data.filter(f => f.place === decodedPlace);
      setFloors(objectFloors);
    } catch (err) {
      setError('Не удалось загрузить этажи');
    } finally {
      setLoading(false);
    }
  };

  const fetchCameras = async () => {
    if (!currentFloor?.id) return;
    try {
      const response = await api.get(`/cameras/floor/${currentFloor.id}`);
      setCameras(response.data);
    } catch (error) {
      console.error('Ошибка загрузки камер:', error);
    }
  };

  const fetchZones = async () => {
    if (!currentFloor?.id) return;
    try {
      const response = await api.get(`/areas/floor/${currentFloor.id}`);
      setZones(response.data);
    } catch (error) {
      console.error('Ошибка загрузки зон:', error);
    }
  };

  const fetchCameraIds = async () => {
    if (!currentFloor?.id) return;
    try {
      const response = await api.get(`/cameras/floor/${currentFloor.id}/ids`);
      setFloorCameraIds(response.data);
    } catch (error) {
      console.error('Ошибка загрузки ID камер:', error);
      setFloorCameraIds([]);
    }
  };

  const handleDeleteFloor = async () => {
    if (!currentFloor) return;
    
    const confirmMessage = `Вы действительно хотите удалить этаж ${currentFloor.number} у объекта "${decodedPlace}"?\n\nВсе камеры и зоны на этом этаже также будут удалены.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      await api.delete(`/floors/${currentFloor.id}`);
      window.location.href = '/objects';
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Ошибка при удалении этажа');
    }
  };

  const handleAddCamera = () => {
    if (currentFloor?.id) {
      navigate(`/floors/${currentFloor.id}/cameras`);
    }
  };

  const handleFloorChange = (floorNumber: number) => {
    setSelectedFloorNumber(floorNumber);
    const floor = floors.find(f => f.number === floorNumber);
    if (floor) {
      setCurrentFloor(floor);
    }
    navigate(`/objects/${encodeURIComponent(decodedPlace)}/floors?floor=${floorNumber}`, { replace: true });
    exitZoneSelectionMode();
  };

  const handlePrevFloor = () => {
    const currentIndex = sortedFloors.findIndex(f => f.number === selectedFloorNumber);
    if (currentIndex > 0) {
      const prevFloor = sortedFloors[currentIndex - 1];
      handleFloorChange(prevFloor.number);
    }
  };

  const handleNextFloor = () => {
    const currentIndex = sortedFloors.findIndex(f => f.number === selectedFloorNumber);
    if (currentIndex < sortedFloors.length - 1) {
      const nextFloor = sortedFloors[currentIndex + 1];
      handleFloorChange(nextFloor.number);
    }
  };

  const handleBack = () => {
    window.location.href = '/objects';
  };

  const startCreateZone = () => {
    setIsSelectingZone(true);
    setSelectedCameras(new Set());
    setEditingZone(null);
  };

  const exitZoneSelectionMode = () => {
    setIsSelectingZone(false);
    setSelectedCameras(new Set());
    setEditingZone(null);
  };

  const editZone = (zone: Zone) => {
    setEditingZone(zone);
    setSelectedCameras(new Set(zone.cameras.map(c => c.id)));
    setIsSelectingZone(true);
    setShowZonesModal(false);
  };

  const isCameraInAnyZone = (cameraId: number): boolean => {
    return zones.some(zone => zone.cameras.some(cam => cam.id === cameraId));
  };

  const getZoneOfCamera = (cameraId: number): Zone | null => {
    return zones.find(zone => zone.cameras.some(cam => cam.id === cameraId)) || null;
  };

  const toggleCameraSelection = (cameraId: number) => {
    const cameraInZone = isCameraInAnyZone(cameraId);
    const cameraZone = getZoneOfCamera(cameraId);
    
    if (editingZone) {
      if (cameraInZone && cameraZone?.id !== editingZone.id) {
        alert(`⚠️ Камера уже находится в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!`);
        return;
      }
      const newSelected = new Set(selectedCameras);
      if (newSelected.has(cameraId)) {
        newSelected.delete(cameraId);
      } else {
        newSelected.add(cameraId);
      }
      setSelectedCameras(newSelected);
      return;
    }
    
    if (cameraInZone) {
      alert(`⚠️ Камера уже находится в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!`);
      return;
    }
    
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

    if (!editingZone) {
      const camerasInOtherZones = Array.from(selectedCameras).filter(camId => isCameraInAnyZone(camId));
      if (camerasInOtherZones.length > 0) {
        alert(`❌ Невозможно создать зону!\n\nНекоторые камеры уже принадлежат другим зонам.`);
        return;
      }
    }

    setSavingZone(true);
    try {
      if (editingZone) {
        await api.patch(`/areas/${editingZone.id}`, {
          camera_ids: Array.from(selectedCameras)
        });
      } else {
        await api.post('/areas/', {
          type: 'green',
          floor_id: currentFloor!.id,
          camera_ids: Array.from(selectedCameras)
        });
      }
      
      await fetchZones();
      exitZoneSelectionMode();
    } catch (error: any) {
      console.error('Ошибка сохранения зоны:', error);
      alert(error.response?.data?.detail || 'Ошибка при сохранении зоны');
    } finally {
      setSavingZone(false);
    }
  };

  const deleteZone = async (zoneId: number) => {
    if (!window.confirm('Удалить эту зону?')) return;
    try {
      await api.delete(`/areas/${zoneId}`);
      await fetchZones();
    } catch (error) {
      console.error('Ошибка удаления зоны:', error);
      alert('Ошибка при удалении зоны');
    }
  };

  const handleOpenSchedule = (zone: Zone) => {
    setScheduleArea(zone);
  };

  const handleZoneUpdated = async () => {
    await fetchZones();
    setUpdateTrigger(prev => prev + 1);
  };

  const handleCameraClick = (cameraId: number) => {
    if (!isAdmin) return;
    const camera = cameras.find(c => c.id === cameraId);
    if (camera) {
      setSelectedCameraForCalibration(camera);
      setShowHomographyCalibration(true);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const selectableElement = target.closest('.selectable-zone, .selectable-camera');
    const cameraElement = target.closest('.clickable-camera');
    
    if (cameraElement && !isSelectingZone && isAdmin) {
      const cameraId = parseInt(cameraElement.getAttribute('data-camera-id') || '0');
      if (cameraId) {
        handleCameraClick(cameraId);
        return;
      }
    }
    
    if (!isSelectingZone) return;
    
    if (selectableElement) {
      const cameraId = parseInt(selectableElement.getAttribute('data-camera-id') || '0');
      if (cameraId) {
        toggleCameraSelection(cameraId);
      }
    }
  };

  const normalizeSvg = (svgContent: string): string => {
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
    
    return svg;
  };

  const svgHtml = useMemo(() => {
    if (!currentFloor?.map) return '';
    return getSvgWithAllElements(normalizeSvg(currentFloor.map));
  }, [currentFloor?.map, cameras, zones, isSelectingZone, selectedCameras, editingZone, detections, blinkingZoneId]);

  const configuredCameras = cameras.filter(c => c.is_configured === true);
  const hasConfiguredCameras = configuredCameras.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
        <Header user={user} onLogout={onLogout} title={decodedPlace} onZoneBlink={setBlinkingZoneId} />
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
        <Header user={user} onLogout={onLogout} title={decodedPlace} onZoneBlink={setBlinkingZoneId} />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-red-400">{error || 'Этаж не найден'}</div>
        </main>
        <Footer />
      </div>
    );
  }

  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);
  const currentIndex = sortedFloors.findIndex(f => f.number === selectedFloorNumber);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < sortedFloors.length - 1;
  const firstFloor = sortedFloors[0];
  const lastFloor = sortedFloors[sortedFloors.length - 1];
  const totalFloors = sortedFloors.length;

  const renderFloorButtons = () => {
    if (totalFloors <= 3) {
      return sortedFloors.map((floor) => (
        <button
          key={floor.number}
          onClick={() => handleFloorChange(floor.number)}
          className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
            selectedFloorNumber === floor.number
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
        >
          {floor.number}
        </button>
      ));
    }

    const buttons = [];
    
    buttons.push(
      <button
        key={firstFloor.number}
        onClick={() => handleFloorChange(firstFloor.number)}
        className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
          selectedFloorNumber === firstFloor.number
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
        }`}
      >
        {firstFloor.number}
      </button>
    );
    
    if (currentIndex > 2) {
      buttons.push(<span key="dots1" className="text-gray-500 px-0.5 text-sm flex-shrink-0">...</span>);
    }
    
    let start = Math.max(1, currentIndex - 1);
    let end = Math.min(totalFloors - 2, start + 2);
    
    if (end - start < 2 && start > 1) {
      start = Math.max(1, end - 2);
    }
    
    for (let i = start; i <= end; i++) {
      const floor = sortedFloors[i];
      if (floor && floor.number !== firstFloor.number && floor.number !== lastFloor.number) {
        buttons.push(
          <button
            key={floor.number}
            onClick={() => handleFloorChange(floor.number)}
            className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
              selectedFloorNumber === floor.number
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {floor.number}
          </button>
        );
      }
    }
    
    if (currentIndex < totalFloors - 3) {
      buttons.push(<span key="dots2" className="text-gray-500 px-0.5 text-sm flex-shrink-0">...</span>);
    }
    
    if (lastFloor && lastFloor.number !== firstFloor.number) {
      buttons.push(
        <button
          key={lastFloor.number}
          onClick={() => handleFloorChange(lastFloor.number)}
          className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
            selectedFloorNumber === lastFloor.number
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
        >
          {lastFloor.number}
        </button>
      );
    }
    
    return buttons;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
      <Header user={user} onLogout={onLogout} title={decodedPlace} onZoneBlink={setBlinkingZoneId} />

      <main className="max-w-7xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-4 mb-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm">Назад</span>
              </button>
              
              {isAdmin && (
                <button onClick={handleDeleteFloor} className="text-red-400 hover:text-red-300 transition-colors" title="Удалить этаж">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <label className="text-gray-300 font-medium whitespace-nowrap mr-1">Этаж:</label>
              
              <button onClick={handlePrevFloor} disabled={!hasPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {renderFloorButtons()}
              
              <button onClick={handleNextFloor} disabled={!hasNext}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2">
              {isAdmin && (
                <button onClick={handleAddCamera}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-500/25">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Добавить камеру
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
            onStartCreate={startCreateZone}
            onCancel={exitZoneSelectionMode}
            onSave={saveZone}
            onOpenZonesList={() => setShowZonesModal(true)}
            isAdmin={isAdmin}
          />
        )}

        {!isAdmin && hasConfiguredCameras && zones.length > 0 && (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-4 mb-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-gray-300">Зелёная зона</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-gray-300">Красная зона</span>
                </div>
              </div>
              <button 
                onClick={() => setShowZonesModal(true)}
                className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors"
              >
                📋 Показать зоны ({zones.length})
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-600/50">
            <h2 className="text-lg font-semibold text-gray-200">
              {decodedPlace} - Этаж {currentFloor.number}
            </h2>
          </div>
          <div 
            className="p-4 bg-gray-900/30 flex justify-center"
            style={{ minHeight: '500px' }}
            onClick={handleSvgClick}
          >
            <div
              ref={mapContainerRef}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
              style={{ 
                maxWidth: '100%',
                height: 'auto',
                display: 'flex',
                justifyContent: 'center'
              }}
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
          onScheduleChange={() => {
            fetchZones();
            setUpdateTrigger(prev => prev + 1);
          }}
          onZoneTypeChange={() => {
            fetchZones();
            setUpdateTrigger(prev => prev + 1);
          }}
          onBackToList={() => {
            setScheduleArea(null);
            setShowZonesModal(true);
          }}
          isAdmin={isAdmin}
        />
      )}

      {showZonesModal && (
        <ZonesListModal
          zones={zones}
          onClose={() => setShowZonesModal(false)}
          onEditZone={editZone}
          onDeleteZone={deleteZone}
          onOpenSchedule={handleOpenSchedule}
          isAdmin={isAdmin}
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
          }}
          onCancel={() => setShowHomographyCalibration(false)}
          isReCalibration={selectedCameraForCalibration.is_configured || false}
        />
      )}
    </div>
  );
};

export default FloorPage;