import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import CameraDrawer from './CameraDrawer';
import HomographyCalibration from './HomographyCalibration';
import ConfirmModal from './ConfirmModal';
import { useAlert } from './CustomAlert';
import { useConfirm } from '../hooks/useConfirm';

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
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_configured?: boolean;
  points_of_homography?: any;
  rotation?: number;
  video_stream?: string;
}

interface FloorCamerasProps {
  user: User | null;
  onLogout: () => void;
}

const FloorCameras = ({ user, onLogout }: FloorCamerasProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, AlertComponent } = useAlert();
  const { confirm, isOpen: confirmOpen, options, handleConfirm, handleCancel } = useConfirm();
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);
  const [showHomographyCalibration, setShowHomographyCalibration] = useState(false);
  const [selectedCameraForCalibration, setSelectedCameraForCalibration] = useState<Camera | null>(null);
  const [movingCamera, setMovingCamera] = useState<Camera | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/objects');
    }
  }, [isAdmin, navigate]);

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

  const fetchZones = async () => {
    try {
      await api.get(`/areas/floor/${id}`);
    } catch (error) {
      console.error('Ошибка обновления зон:', error);
    }
  };

  const handleSaveCamera = async (cameraData: any) => {
    try {
      await api.post('/cameras', {
        ...cameraData,
        floor_id: parseInt(id || '0')
      });
      await fetchCameras();
      await fetchZones();
      setShowCameraDrawer(false);
      setMovingCamera(null);
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      showAlert('Камера успешно добавлена', 'success');
    } catch (error) {
      console.error('Ошибка сохранения камеры:', error);
      showAlert('Ошибка при сохранении камеры', 'error');
    }
  };

  const handleUpdateCamera = async (cameraId: number, cameraData: any) => {
    console.log('Updating camera:', cameraId, cameraData);
    try {
      await api.patch(`/cameras/${cameraId}`, {
        position: cameraData.position,
        visible_zone: cameraData.visible_zone,
        is_configured: false,
        points_of_homography: null,
        rotation: cameraData.rotation
      });
      await fetchCameras();
      await fetchZones();
      setShowCameraDrawer(false);
      setMovingCamera(null);
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      showAlert('Камера успешно перемещена, требуется повторная калибровка', 'success');
    } catch (error) {
      console.error('Ошибка обновления камеры:', error);
      showAlert('Ошибка при перемещении камеры', 'error');
    }
  };

  const handleDeleteCamera = async (cameraId: number) => {
    const confirmed = await confirm({
      title: 'Удаление камеры',
      message: `Удалить камеру #${cameraId}? Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/cameras/${cameraId}`);
      await fetchCameras();
      await fetchZones();
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      showAlert('Камера успешно удалена', 'success');
    } catch (error) {
      console.error('Ошибка удаления камеры:', error);
      showAlert('Ошибка при удалении камеры', 'error');
    }
  };

  const handleMoveCamera = (camera: Camera) => {
    console.log('Moving camera:', camera);
    setMovingCamera(camera);
    setShowCameraDrawer(true);
  };

  const openHomographyCalibration = (camera: Camera) => {
    setSelectedCameraForCalibration(camera);
    setShowHomographyCalibration(true);
  };

  const handleBackToFloor = () => {
    if (floor?.place && floor?.number) {
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
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
        const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.15)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" data-camera-id="${camera.id}" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
        
        // ID камеры в центре зоны видимости - увеличенный размер (28px), жирный, черная обводка
        const vertices = camera.visible_zone.vertices;
        const centerX = vertices.reduce((sum, p) => sum + p[0], 0) / vertices.length;
        const centerY = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length;
        const idText = `<text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-size="28" font-weight="bold" fill="#FF4444" stroke="#000000" stroke-width="2" style="pointer-events:none">${camera.id}</text>`;
        modifiedSvg = modifiedSvg.replace('</svg>', idText + '</svg>');
      }
      
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        const cameraIcon = `
          <g transform="translate(${x - 14}, ${y - 14})">
            <circle cx="14" cy="14" r="14" fill="#FF4444" stroke="#000000" stroke-width="2" />
            <circle cx="14" cy="14" r="7" fill="#fff" />
            <circle cx="14" cy="14" r="3" fill="#FF4444" />
          </g>
        `;
        modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
      }
    });
    
    return modifiedSvg;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
        <Header user={user} onLogout={onLogout} title="Добавление камер" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-400">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
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
      <Header user={user} onLogout={onLogout} title={`Добавление камер: ${floor?.place} - Этаж ${floor?.number}`} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <button
                onClick={handleBackToFloor}
                className="bg-gray-700 text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-600 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Вернуться к этажу
              </button>
              {!showCameraDrawer && (
                <button
                  onClick={() => {
                    setMovingCamera(null);
                    setShowCameraDrawer(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Добавить камеру
                </button>
              )}
            </div>
            
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Камеры этажа
            </h1>
          </div>

          <div className="border border-gray-600 rounded-xl p-4 bg-gray-900/30">
            {showCameraDrawer && floor?.map ? (
              <CameraDrawer
                svgContent={floor.map}
                existingCameras={cameras}
                editingCamera={movingCamera}
                onSave={movingCamera ? (cameraData) => handleUpdateCamera(movingCamera.id, cameraData) : handleSaveCamera}
                onCancel={() => {
                  setShowCameraDrawer(false);
                  setMovingCamera(null);
                }}
              />
            ) : (
              <div className="overflow-auto max-h-[600px]">
                {cameras.length === 0 && (
                  <div className="text-center text-gray-400 mb-4 py-8">
                    <div className="text-5xl mb-3">🎥</div>
                    <p>Нет добавленных камер</p>
                    <p className="text-sm text-gray-500 mt-1">Нажмите "Добавить камеру"</p>
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
            <div className="border-t border-gray-700 mt-6 pt-4">
              <h3 className="text-md font-semibold text-gray-300 mb-3">
                Список камер ({cameras.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-auto">
                {cameras.map((camera) => (
                  <div key={camera.id} className="bg-gray-700/50 rounded-xl p-3 border border-gray-600">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-200">Камера #{camera.id}</span>
                        {camera.is_configured ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Откалибрована
                          </span>
                        ) : (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Не откалибрована
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMoveCamera(camera)}
                          className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                          title="Переместить камеру"
                        >
                          📍 Переместить
                        </button>
                        {camera.is_configured ? (
                          <button
                            onClick={() => openHomographyCalibration(camera)}
                            className="text-purple-400 hover:text-purple-300 text-sm px-3 py-1 rounded-lg hover:bg-purple-500/10 transition-colors"
                          >
                            Перекалибровать
                          </button>
                        ) : (
                          <button
                            onClick={() => openHomographyCalibration(camera)}
                            className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                          >
                            Задать точки гомографии
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCamera(camera.id)}
                          className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {showHomographyCalibration && selectedCameraForCalibration && (
        <HomographyCalibration
          cameraId={selectedCameraForCalibration.id}
          cameraZone={selectedCameraForCalibration.visible_zone.vertices}
          cameraPosition={selectedCameraForCalibration.position}
          svgContent={floor?.map || ''}
          onSave={() => {
            setShowHomographyCalibration(false);
            fetchCameras();
            showAlert('Калибровка камеры успешно сохранена', 'success');
          }}
          onCancel={() => setShowHomographyCalibration(false)}
          isReCalibration={selectedCameraForCalibration.is_configured || false}
        />
      )}
    </div>
  );
};

export default FloorCameras;