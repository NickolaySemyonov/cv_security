// frontend/src/components/FloorPage.tsx
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { detections, getDetectionsByFloor, registerFloorCameras, isConnected } = useCameraDetection();

  // Получаем ВСЕ настроенные камеры на этом этаже
  const configuredCamerasOnThisFloor = cameras.filter(c => c.is_configured === true && c.floor_id === currentFloor?.id);
  const hasAnyConfiguredCamera = configuredCamerasOnThisFloor.length > 0;
  
  // Получаем ID этажа (если есть настроенные камеры)
  const cameraFloorId = hasAnyConfiguredCamera ? currentFloor?.id : null;
  
  // Получаем детекции для этажа с камерами
  const floorDetections = getDetectionsByFloor(cameraFloorId || 0);
  
  // Показываем детекции только если на текущем этаже есть настроенные камеры
  const shouldShowDetections = hasAnyConfiguredCamera;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const floorParam = params.get('floor');
    if (floorParam && isInitialLoad) {
      setSelectedFloorNumber(parseInt(floorParam));
      setIsInitialLoad(false);
    }
  }, [location.search, isInitialLoad]);

  useEffect(() => {
    fetchFloors();
  }, [decodedPlace]);

  useEffect(() => {
    if (floors.length > 0) {
      const floor = floors.find(f => f.number === selectedFloorNumber);
      if (floor) {
        setCurrentFloor(floor);
      } else if (floors.length > 0) {
        setCurrentFloor(floors[0]);
        setSelectedFloorNumber(floors[0].number);
      }
    }
  }, [selectedFloorNumber, floors]);

  useEffect(() => {
    if (currentFloor?.id) {
      fetchCameras();
    }
  }, [currentFloor?.id]);

  useEffect(() => {
    if (currentFloor?.id && cameras.length > 0) {
      const allConfiguredCameraIds = cameras.filter(c => c.is_configured === true).map(c => c.id);
      if (allConfiguredCameraIds.length > 0) {
        registerFloorCameras(currentFloor.id, allConfiguredCameraIds);
      }
    }
  }, [currentFloor?.id, cameras, registerFloorCameras]);

  useEffect(() => {
    const checkCamerasUpdate = () => {
      const camerasUpdated = sessionStorage.getItem('camerasUpdated');
      if (camerasUpdated && currentFloor?.id) {
        sessionStorage.removeItem('camerasUpdated');
        fetchCameras();
      }
    };
    
    checkCamerasUpdate();
    
    const handleFocus = () => {
      if (currentFloor?.id) {
        fetchCameras();
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
      
      if (objectFloors.length > 0) {
        const targetFloor = objectFloors.find(f => f.number === selectedFloorNumber);
        if (targetFloor) {
          setCurrentFloor(targetFloor);
        } else {
          setCurrentFloor(objectFloors[0]);
          setSelectedFloorNumber(objectFloors[0].number);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
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
    navigate(`/objects/${encodeURIComponent(decodedPlace)}/floors?floor=${floorNumber}`, { replace: true });
  };

  const handleBack = () => {
    navigate('/objects');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} title={decodedPlace} />

      <main className="max-w-7xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Назад
            </button>
            <label className="text-gray-700 font-medium">Этаж:</label>
            <div className="flex gap-2">
              {sortedFloors.map((floor) => (
                <button
                  key={floor.number}
                  onClick={() => handleFloorChange(floor.number)}
                  className={`px-4 py-2 rounded-xl transition-all duration-200 ${
                    selectedFloorNumber === floor.number
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {floor.number}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSetup}
              className={`px-5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                currentFloor.is_calibrated
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z" />
              </svg>
              {currentFloor.is_calibrated ? 'Калибровка (обновить)' : 'Калибровка'}
            </button>

            {currentFloor.is_calibrated && (
              <button
                onClick={handleAddCamera}
                className="bg-blue-500 text-white px-5 py-2 rounded-xl hover:bg-blue-600 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                + Добавить камеру
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              {decodedPlace} - Этаж {currentFloor.number}
              {currentFloor.is_calibrated && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  ✓ Откалиброван
                </span>
              )}
              {configuredCamerasCount > 0 && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  🎥 {configuredCamerasCount} {configuredCamerasCount === 1 ? 'камера' : 'камер'}
                </span>
              )}
              {isConnected && shouldShowDetections && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  🟢 Детекция активна
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