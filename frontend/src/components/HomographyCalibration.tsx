// frontend/src/components/HomographyCalibration.tsx
import { useState, useRef, useEffect } from 'react';
import api from '../config/axios';

interface Point {
  x: number;
  y: number;
}

interface HomographyCalibrationProps {
  cameraId: number;
  cameraZone: number[][];
  cameraPosition: { x: number; y: number };
  onSave: () => void;
  onCancel: () => void;
}

const HomographyCalibration = ({ 
  cameraId, 
  cameraZone, 
  onSave, 
  onCancel 
}: HomographyCalibrationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Запуск камеры
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Не удалось получить доступ к камере'));
    
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Получение координат клика
  const getVideoCoords = (e: React.MouseEvent<HTMLVideoElement>): Point | null => {
    const video = videoRef.current;
    if (!video) return null;
    
    const rect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return x >= 0 && x <= video.videoWidth && y >= 0 && y <= video.videoHeight 
      ? { x, y } : null;
  };

  // Рисование точек
  const drawPoints = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scaleX = video.clientWidth / video.videoWidth;
    const scaleY = video.clientHeight / video.videoHeight;
    
    points.forEach((point, i) => {
      const x = point.x * scaleX;
      const y = point.y * scaleY;
      
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = '#4CAF50';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((i + 1).toString(), x, y);
    });
  };

  useEffect(() => {
    drawPoints();
  }, [points]);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (points.length >= 4) return;
    const coords = getVideoCoords(e);
    if (coords) setPoints([...points, coords]);
  };

  const handleSave = async () => {
    if (points.length !== 4) {
      setError('Необходимо отметить 4 точки');
      return;
    }
    
    setIsLoading(true);
    
    const dstPoints = cameraZone.map(v => ({ x: v[0], y: v[1] }));
    
    try {
      await api.patch(`/cameras/${cameraId}/homography`, {
        points_of_homography: {
          src_points: points.map(p => [p.x, p.y]),
          dst_points: dstPoints.map(p => [p.x, p.y])
        },
        is_configured: true
      });
      onSave();
    } catch (err) {
      setError('Ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-2">Калибровка гомографии - Камера {cameraId}</h2>
        <p className="text-gray-600 mb-4">
          {points.length < 4 
            ? `📍 Отметьте ${4 - points.length} точки на видео (углы зоны видимости)`
            : '✅ Все точки отмечены! Нажмите "Сохранить"'}
        </p>
        
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto cursor-crosshair"
            onClick={handleVideoClick}
            onLoadedMetadata={drawPoints}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
        
        {/* Индикатор прогресса */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                ${points[i] ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}
              `}
            >
              {i + 1}
            </div>
          ))}
        </div>
        
        {/* Кнопки управления */}
        {points.length > 0 && (
          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => setPoints(points.slice(0, -1))} 
              className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
            >
              ↩ Отменить последнюю
            </button>
            <button 
              onClick={() => setPoints([])} 
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
            >
              🗑 Сбросить всё
            </button>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-2 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            disabled={isLoading}
          >
            Отмена
          </button>
          <button 
            onClick={handleSave} 
            disabled={points.length !== 4 || isLoading} 
            className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50 hover:bg-green-600"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          💡 Инструкция: Отметьте 4 точки на видео в порядке: левый верхний → правый верхний → правый нижний → левый нижний
        </div>
      </div>
    </div>
  );
};

export default HomographyCalibration;