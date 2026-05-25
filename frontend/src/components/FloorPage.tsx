import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import { ZoneManagementPanel } from './ZoneManagementPanel';
import { useSvgRenderer } from '../hooks/useSvgRenderer';
import { useCameraDetection } from '../hooks/useCameraDetection';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
  is_calibrated?: boolean;
}

interface User {
  id: number;
  login: string;
}

interface Camera {
  id: number;
  floor_id: number;
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
  
  // Режим выделения зон
  const [isSelectingZone, setIsSelectingZone] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<number>>(new Set());
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [showZonesList, setShowZonesList] = useState(false);

  const { detections, getDetectionsByFloor, registerFloorCameras, clearDetections, isConnected } = useCameraDetection();
  const { getSvgWithAllElements } = useSvgRenderer(
    cameras, zones, isSelectingZone, selectedCameras, editingZone, 
    getDetectionsByFloor, currentFloor?.id || 0
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
    
    const confirmMessage = `Вы действительно хотите удалить этаж ${currentFloor.number} у объекта "${decodedPlace}"?\n\nВсе камеры на этом этаже также будут удалены.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      await api.delete(`/floors/${currentFloor.id}`);
      window.location.href = '/objects';
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Ошибка при удалении этажа');
    }
  };

  const handleSetup = () => {
    if (currentFloor?.id) {
      navigate(`/floors/${currentFloor.id}/setup`);
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

  // Функции для работы с зонами
  const startCreateZone = () => {
    setIsSelectingZone(true);
    setSelectedCameras(new Set());
    setEditingZone(null);
    setShowZonesList(false);
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
    setShowZonesList(false);
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
        alert(`⚠️ Камера уже находится в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!\n\nСначала удалите камеру из существующей зоны или удалите зону целиком.`);
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
      alert(`⚠️ Камера уже находится в ${cameraZone?.type === 'red' ? 'КРАСНОЙ' : 'ЗЕЛЁНОЙ'} зоне!\n\nКамера не может быть в двух зонах одновременно.`);
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
        alert(`❌ Невозможно создать зону!\n\nНекоторые камеры уже принадлежат другим зонам.\n\nСначала удалите их из существующих зон.`);
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

  const toggleZoneType = async (zoneId: number) => {
    try {
      await api.post(`/areas/${zoneId}/toggle-type`);
      await fetchZones();
    } catch (error) {
      console.error('Ошибка изменения типа зоны:', error);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingZone) return;
    
    const target = e.target as HTMLElement;
    const selectableElement = target.closest('.selectable-zone, .selectable-camera');
    
    if (selectableElement) {
      const cameraId = parseInt(selectableElement.getAttribute('data-camera-id') || '0');
      if (cameraId) {
        toggleCameraSelection(cameraId);
      }
    }
  };

  const configuredCameras = cameras.filter(c => c.is_configured === true);
  const hasConfiguredCameras = configuredCameras.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={user} onLogout={onLogout} title={decodedPlace} />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-600">Загрузка этажей...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !currentFloor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={user} onLogout={onLogout} title={decodedPlace} />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-red-600">{error || 'Этаж не найден'}</div>
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
          className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-colors ${
            selectedFloorNumber === floor.number
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
        className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-colors ${
          selectedFloorNumber === firstFloor.number
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {firstFloor.number}
      </button>
    );
    
    if (currentIndex > 2) {
      buttons.push(<span key="dots1" className="text-gray-400 px-0.5 text-sm flex-shrink-0">...</span>);
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
            className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-colors ${
              selectedFloorNumber === floor.number
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {floor.number}
          </button>
        );
      }
    }
    
    if (currentIndex < totalFloors - 3) {
      buttons.push(<span key="dots2" className="text-gray-400 px-0.5 text-sm flex-shrink-0">...</span>);
    }
    
    if (lastFloor && lastFloor.number !== firstFloor.number) {
      buttons.push(
        <button
          key={lastFloor.number}
          onClick={() => handleFloorChange(lastFloor.number)}
          className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-colors ${
            selectedFloorNumber === lastFloor.number
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {lastFloor.number}
        </button>
      );
    }
    
    return buttons;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} title={decodedPlace} />

      <main className="max-w-7xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm">Назад</span>
              </button>
              
              <button onClick={handleDeleteFloor} className="text-red-600 hover:text-red-800" title="Удалить этаж">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <label className="text-gray-700 font-medium whitespace-nowrap mr-1">Этаж:</label>
              
              <button onClick={handlePrevFloor} disabled={!hasPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                style={{ backgroundColor: hasPrev ? '#f3f4f6' : '#f9fafb' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {renderFloorButtons()}
              
              <button onClick={handleNextFloor} disabled={!hasNext}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                style={{ backgroundColor: hasNext ? '#f3f4f6' : '#f9fafb' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handleSetup}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${
                  currentFloor.is_calibrated ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Калибровка
              </button>

              {currentFloor.is_calibrated && (
                <button onClick={handleAddCamera}
                  className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 flex items-center gap-1 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Добавить камеру
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Панель управления зонами */}
        {currentFloor.is_calibrated && hasConfiguredCameras && (
          <ZoneManagementPanel
            zones={zones}
            isSelectingZone={isSelectingZone}
            selectedCamerasCount={selectedCameras.size}
            savingZone={savingZone}
            editingZone={editingZone}
            showZonesList={showZonesList}
            onStartCreate={startCreateZone}
            onCancel={exitZoneSelectionMode}
            onSave={saveZone}
            onToggleList={() => setShowZonesList(!showZonesList)}
            onEditZone={editZone}
            onDeleteZone={deleteZone}
            onToggleType={toggleZoneType}
          />
        )}

        {/* Карта */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              {decodedPlace} - Этаж {currentFloor.number}
              {currentFloor.is_calibrated && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              )}
            </h2>
          </div>
          <div 
            className="p-4 bg-gray-50 flex justify-center"
            style={{ minHeight: '500px' }}
            onClick={handleSvgClick}
          >
            <div
              ref={mapContainerRef}
              dangerouslySetInnerHTML={{ __html: getSvgWithAllElements(currentFloor.map) }}
              style={{ width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FloorPage;