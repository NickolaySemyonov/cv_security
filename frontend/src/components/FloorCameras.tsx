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

interface User {
  id: number;
  login: string;
}

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_active: boolean;
}

interface FloorCamerasProps {
  user: User | null;
  onLogout: () => void;
}

const FloorCameras = ({ user, onLogout }: FloorCamerasProps) => {
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
      const response = await api.get(`/cameras/floor/${id}`);
      setCameras(response.data);
    } catch (error) {
      console.error('Ошибка загрузки камер:', error);
    }
  };

  const handleSaveCamera = async (cameraData: any) => {
    try {
      await api.post('/cameras', {
        ...cameraData,
        floor_id: parseInt(id || '0')
      });
      await fetchCameras();
      setShowCameraDrawer(false);
    } catch (error) {
      console.error('Ошибка сохранения камеры:', error);
      alert('Ошибка при сохранении камеры');
    }
  };

  const handleDeleteCamera = async (cameraId: number) => {
    if (window.confirm('Удалить эту камеру?')) {
      try {
        await api.delete(`/cameras/${cameraId}`);
        await fetchCameras();
      } catch (error) {
        console.error('Ошибка удаления камеры:', error);
        alert('Ошибка при удалении камеры');
      }
    }
  };

  const handleBackToFloor = () => {
    if (floor?.place && floor?.number) {
      // Передаём параметр refresh для принудительного обновления
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}&refresh=${Date.now()}`);
    } else {
      navigate('/objects');
    }
  };

  const getSvgWithCameras = (svgContent: string): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = svgContent;
    
    cameras.forEach((camera) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
 proiektuak.
        <Header user={user} onLogout={onLogout} title="Добавление камер" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-600">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} title={`Добавление камер: ${floor?.place} - Этаж ${floor?.number}`} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Камеры этажа
            </h1>
            <div className="flex gap-3">
              {!showCameraDrawer && (
                <button
                  onClick={() => setShowCameraDrawer(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  + Добавить камеру
                </button>
              )}
              <button
                onClick={handleBackToFloor}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                ← Вернуться к этажу
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            {showCameraDrawer && floor?.map ? (
              <CameraDrawer
                svgContent={floor.map}
                existingCameras={cameras}
                onSave={handleSaveCamera}
                onCancel={() => setShowCameraDrawer(false)}
              />
            ) : (
              <div className="overflow-auto max-h-[600px]">
                {cameras.length === 0 && (
                  <div className="text-center text-gray-500 mb-4 py-8">
                    🎥 Нет добавленных камер. Нажмите "+ Добавить камеру"
                  </div>
                )}
                <div
                  dangerouslySetInnerHTML={{ __html: getSvgWithCameras(floor?.map || '') }}
                  className="inline-block w-full"
                />
              </div>
            )}
          </div>

          {cameras.length > 0 && !showCameraDrawer && (
            <div className="border-t border-gray-200 mt-6 pt-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">
                Список камер ({cameras.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-auto">
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
                      className="text-red-500 hover:text-red-700 text-sm px-3 py-1 rounded hover:bg-red-50"
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

export default FloorCameras;