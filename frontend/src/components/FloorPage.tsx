import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import { useCameraDetection } from '../hooks/useCameraDetection';
import DetectionOverlay from '../components/DetectionOverlay';

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

interface FloorPageProps {
  user: User | null;
  onLogout: () => void;
}

const FloorPage = ({ user, onLogout }: FloorPageProps) => {
  const { place } = useParams<{ place: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const decodedPlace = decodeURIComponent(place || '');
  
  const [floors, setFloors] = useState<Floor[]>([]);
  const [currentFloor, setCurrentFloor] = useState<Floor | null>(null);
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [floorCameraIds, setFloorCameraIds] = useState<number[]>([]);

  const { detections, getDetectionsByFloor, registerFloorCameras, clearDetections, isConnected } = useCameraDetection();

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
          setUpdateTrigger(prev => prev + 1);
        }
      }
    };
    
    checkCamerasUpdate();
    
    const handleFocus = () => {
      if (currentFloor?.id) {
        fetchCameraIds();
        fetchCameras();
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

  const getSvgWithCameras = (svgContent: string): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = svgContent;
    const configuredCameras = cameras.filter(c => c.is_configured === true);
    
    configuredCameras.forEach((camera) => {
      if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.15)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
      
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        const cameraIcon = `
          <g transform="translate(${x - 12}, ${y - 12})">
            <circle cx="12" cy="12" r="12" fill="#FF4444" stroke="#fff" stroke-width="2" />
            <circle cx="12" cy="12" r="6" fill="#fff" />
            <circle cx="12" cy="12" r="3" fill="#FF4444" />
          </g>
        `;
        modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
      }
    });
    
    return modifiedSvg;
  };

  const camerasForOverlay = cameras
    .filter(c => c.is_configured === true)
    .map(c => ({
      id: c.id,
      zone: c.visible_zone.vertices
    }));

  const configuredCamerasCount = cameras.filter(c => c.is_configured === true).length;
  
  const floorDetections = getDetectionsByFloor(currentFloor?.id || 0);

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
            <div className="flex items-center gap-3 w-[200px]">
              <button
                onClick={handleBack}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm"></span>
              </button>
              
              <button
                onClick={handleDeleteFloor}
                className="text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors"
                title="Удалить этаж"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <label className="text-gray-700 font-medium whitespace-nowrap mr-1">Этаж:</label>
              
              <button
                onClick={handlePrevFloor}
                disabled={!hasPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: hasPrev ? '#f3f4f6' : '#f9fafb',
                  color: hasPrev ? '#374151' : '#d1d5db',
                  cursor: hasPrev ? 'pointer' : 'not-allowed'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {renderFloorButtons()}
              
              <button
                onClick={handleNextFloor}
                disabled={!hasNext}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: hasNext ? '#f3f4f6' : '#f9fafb',
                  color: hasNext ? '#374151' : '#d1d5db',
                  cursor: hasNext ? 'pointer' : 'not-allowed'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2 w-[240px] justify-end">
              <button
                onClick={handleSetup}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                  currentFloor.is_calibrated
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Калибровка
              </button>

              {currentFloor.is_calibrated && (
                <button
                  onClick={handleAddCamera}
                  className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1 whitespace-nowrap text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Добавить камеру
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              {decodedPlace} - Этаж {currentFloor.number}
              {currentFloor.is_calibrated && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  ✓
                </span>
              )}
            </h2>
          </div>
          <div 
            className="p-4 bg-gray-50 flex justify-center overflow-auto"
            style={{ minHeight: '500px' }}
          >
            <DetectionOverlay
              svgContent={getSvgWithCameras(currentFloor.map)}
              detections={floorDetections}
              cameras={camerasForOverlay}
              isConnected={isConnected}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FloorPage;