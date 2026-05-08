// frontend/src/components/FloorCameras.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import CameraDrawer from './CameraDrawer';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface Point {
  x: number;
  y: number;
}

interface Camera {
  id: number;
  position: Point;
  zone: Point[];
}

interface FloorCamerasProps {
  onLogout: () => void;
}

const FloorCameras = ({ onLogout }: FloorCamerasProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);

  useEffect(() => {
    fetchFloor();
    fetchCameras();
  }, [id]);

  const fetchFloor = async () => {
    try {
      const response = await api.get(`/floors/${id}`);
      setFloor(response.data);
    } catch (error) {
      console.error('Ошибка загрузки этажа:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCameras = async () => {
    try {
      const response = await api.get(`/floors/${id}/cameras`);
      setCameras(response.data);
    } catch (error) {
      console.error('Ошибка загрузки камер:', error);
    }
  };

  const handleSaveCamera = async (cameraData: { position: Point; zone: Point[] }) => {
    try {
      await api.post(`/floors/${id}/cameras`, cameraData);
      await fetchCameras();
      setShowCameraDrawer(false);
    } catch (error) {
      console.error('Ошибка сохранения камеры:', error);
    }
  };

  const handleBackToFloor = () => {
    if (floor?.place && floor?.number) {
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
    } else {
      navigate('/objects');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={null} onLogout={onLogout} title="Добавление камер" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-600">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={null} onLogout={onLogout} title={`Добавление камер: ${floor?.place} - Этаж ${floor?.number}`} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Добавление камер
            </h1>
            <button
              onClick={handleBackToFloor}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              ← Вернуться к этажу
            </button>
          </div>

          {/* Карта этажа с камерами */}
          <div className="border rounded-lg p-4 bg-gray-50 mb-6">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-gray-500">Карта этажа:</p>
              <button
                onClick={() => setShowCameraDrawer(!showCameraDrawer)}
                className="bg-blue-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-blue-600"
              >
                {showCameraDrawer ? 'Отменить' : '+ Добавить камеру'}
              </button>
            </div>
            
            {showCameraDrawer && floor?.map && (
              <CameraDrawer
                svgContent={floor.map}
                onSave={handleSaveCamera}
                onCancel={() => setShowCameraDrawer(false)}
              />
            )}
            
            <div className="border rounded-lg p-2 bg-white overflow-auto max-h-96">
              <div
                dangerouslySetInnerHTML={{ __html: getSvgWithCameras(floor?.map || '', cameras) }}
                className="inline-block"
              />
            </div>
          </div>

          {/* Список добавленных камер */}
          {cameras.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">
                Добавленные камеры ({cameras.length})
              </h3>
              <div className="space-y-2">
                {cameras.map((camera, idx) => (
                  <div key={camera.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <span className="font-medium">Камера {idx + 1}</span>
                      <span className="text-sm text-gray-500 ml-3">
                        Позиция: ({Math.round(camera.position.x)}, {Math.round(camera.position.y)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCamera(camera.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

// Функция для отображения камер на SVG
function getSvgWithCameras(svgContent: string, cameras: Camera[]): string {
  if (!svgContent) return '';
  
  const svgEndIndex = svgContent.lastIndexOf('</svg>');
  if (svgEndIndex === -1) return svgContent;
  
  let camerasSvg = '';
  
  cameras.forEach((camera) => {
    // Рисуем зону видимости
    if (camera.zone && camera.zone.length === 4) {
      const points = camera.zone.map(p => `${p.x},${p.y}`).join(' ');
      camerasSvg += `
        <polygon
          points="${points}"
          fill="rgba(100, 150, 255, 0.15)"
          stroke="#6495ED"
          stroke-width="2"
          stroke-dasharray="4,4"
        />
      `;
    }
    
    // Рисуем иконку камеры
    if (camera.position) {
      camerasSvg += `
        <g transform="translate(${camera.position.x - 10}, ${camera.position.y - 10})">
          <circle cx="10" cy="10" r="10" fill="#FF4444" stroke="#fff" stroke-width="2" />
          <circle cx="10" cy="10" r="5" fill="#fff" />
          <circle cx="10" cy="10" r="2.5" fill="#FF4444" />
        </g>
      `;
    }
  });
  
  return svgContent.slice(0, svgEndIndex) + camerasSvg + svgContent.slice(svgEndIndex);
}

async function handleDeleteCamera(cameraId: number) {
  // TODO: реализовать удаление камеры
  console.log('Удаление камеры:', cameraId);
}

export default FloorCameras;