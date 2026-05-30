import { useState, useRef, useEffect } from 'react';
import api from '../config/axios';

interface Point {
  x: number;
  y: number;
}

interface VideoFile {
  name: string;
  url: string;
  size_mb: number;
}

interface HomographyCalibrationProps {
  cameraId: number;
  cameraZone: number[][];
  cameraPosition: { x: number; y: number };
  svgContent: string;
  onSave: () => void;
  onCancel: () => void;
  isReCalibration?: boolean;
}

const HomographyCalibration = ({ 
  cameraId, 
  cameraZone, 
  cameraPosition,
  svgContent,
  onSave, 
  onCancel,
  isReCalibration = false
}: HomographyCalibrationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dstCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [step, setStep] = useState<'settings' | 'video' | 'save'>('settings');
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoPoints, setVideoPoints] = useState<Point[]>([]);
  const [mapPoints, setMapPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  const [frameWidth, setFrameWidth] = useState<number>(640);
  const [frameHeight, setFrameHeight] = useState<number>(480);

  useEffect(() => {
    if (step === 'settings') {
      fetchVideos();
    }
  }, [step]);

  const fetchVideos = async () => {
    try {
      setLoadingVideos(true);
      const response = await api.get('/videos/list');
      setVideos(response.data.videos || []);
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      setError('Не удалось загрузить список видео');
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleNextFromSettings = () => {
    if (!selectedVideo) {
      setError('Выберите видеофайл');
      return;
    }
    if (frameWidth <= 0 || frameHeight <= 0) {
      setError('Введите корректное разрешение камеры');
      return;
    }
    setError(null);
    setStep('video');
    setVideoPoints([]);
    setMapPoints([]);
    setVideoLoaded(false);
  };

  useEffect(() => {
    if (step === 'video' && videoRef.current && selectedVideo) {
      videoRef.current.src = `http://localhost:8000${selectedVideo}`;
      videoRef.current.load();
    }
  }, [step, selectedVideo]);

  const onVideoLoaded = () => {
    setVideoLoaded(true);
    setTimeout(() => drawVideoPoints(), 100);
  };

  const onVideoError = () => {
    setError('Не удалось загрузить видео');
    setVideoLoaded(false);
  };

  const getVideoCoords = (e: React.MouseEvent<HTMLVideoElement>): Point | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    
    const rect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (x >= 0 && x <= video.videoWidth && y >= 0 && y <= video.videoHeight) {
      return { x, y };
    }
    return null;
  };

  const getDstCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const canvas = dstCanvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
      return { x, y };
    }
    return null;
  };

  const drawVideoPoints = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    
    videoPoints.forEach((point, i) => {
      const x = point.x * scaleX;
      const y = point.y * scaleY;
      
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
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

  const drawDstPoints = () => {
    const canvas = dstCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * canvas.width / 4, 0);
      ctx.lineTo(i * canvas.width / 4, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * canvas.height / 4);
      ctx.lineTo(canvas.width, i * canvas.height / 4);
      ctx.stroke();
    }
    
    mapPoints.forEach((point, i) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#4CAF50';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((i + 1).toString(), point.x, point.y);
    });
  };

  useEffect(() => {
    if (step === 'video' && videoLoaded) {
      drawVideoPoints();
    }
  }, [videoPoints, step, videoLoaded]);

  useEffect(() => {
    if (step === 'video') {
      drawDstPoints();
    }
  }, [mapPoints, step, frameWidth, frameHeight]);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (step !== 'video' || videoPoints.length >= 4) return;
    const coords = getVideoCoords(e);
    if (coords) {
      setVideoPoints([...videoPoints, coords]);
    }
  };

  const handleDstCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step !== 'video' || mapPoints.length >= 4) return;
    const coords = getDstCanvasCoords(e);
    if (coords) {
      setMapPoints([...mapPoints, coords]);
    }
  };

  const undoLastVideoPoint = () => {
    if (videoPoints.length > 0) {
      setVideoPoints(videoPoints.slice(0, -1));
    }
  };

  const undoLastMapPoint = () => {
    if (mapPoints.length > 0) {
      setMapPoints(mapPoints.slice(0, -1));
    }
  };

  const resetAllPoints = () => {
    setVideoPoints([]);
    setMapPoints([]);
  };

  const handleSave = async () => {
    if (videoPoints.length !== 4 || mapPoints.length !== 4) {
      setError('Необходимо отметить 4 точки на видео и 4 точки на схеме');
      return;
    }
    
    setIsLoading(true);
    
    const homographyData = {
      src_points: videoPoints.map(p => [p.x, p.y]),
      dst_points: mapPoints.map(p => [p.x, p.y])
    };
    
    try {
      await api.patch(`/cameras/${cameraId}/homography`, {
        points_of_homography: homographyData,
        video_stream: selectedVideo,
        frame_shape: { width: frameWidth, height: frameHeight },
        is_configured: true
      });
      onSave();
    } catch (err) {
      setError('Ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'settings') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto">
          <h2 className="text-2xl font-bold mb-2">
            {isReCalibration ? 'Перекалибровка камеры' : 'Калибровка камеры'} {cameraId}
          </h2>
          <p className="text-gray-600 mb-6">Введите параметры камеры</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Разрешение камеры</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={frameWidth}
                  onChange={(e) => setFrameWidth(parseInt(e.target.value) || 640)}
                  placeholder="Ширина"
                  className="w-1/2 px-3 py-2 border rounded-lg"
                />
                <span className="self-center">x</span>
                <input
                  type="number"
                  value={frameHeight}
                  onChange={(e) => setFrameHeight(parseInt(e.target.value) || 480)}
                  placeholder="Высота"
                  className="w-1/2 px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Видеофайл для калибровки</label>
              {loadingVideos ? (
                <div className="text-center py-4 text-gray-500">Загрузка видео...</div>
              ) : videos.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Нет видео файлов в папке storage/videos/
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-lg p-2">
                  {videos.map((video) => (
                    <div
                      key={video.name}
                      onClick={() => setSelectedVideo(video.url)}
                      className={`border rounded-lg p-2 cursor-pointer transition-all text-center ${
                        selectedVideo === video.url ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                      }`}
                    >
                      <div className="text-sm truncate">{video.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {error && <div className="mt-4 p-2 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
          
          <div className="flex justify-between mt-6">
            <button onClick={onCancel} className="px-4 py-2 bg-gray-500 text-white rounded-lg">
              Отмена
            </button>
            <button onClick={handleNextFromSettings} className="px-4 py-2 bg-blue-500 text-white rounded-lg">
              Далее →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Калибровка гомографии</h2>
          <button onClick={() => setStep('settings')} className="text-gray-500 hover:text-gray-700">
            ← Назад к настройкам
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">1. Отметьте 4 точки на видео</h3>
            <p className="text-sm text-gray-500 mb-4">
              Отмечено точек: {videoPoints.length}/4
            </p>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto cursor-crosshair"
                onClick={handleVideoClick}
                onLoadedData={onVideoLoaded}
                onError={onVideoError}
                style={{ maxWidth: '100%', height: 'auto', maxHeight: '400px' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>
            {!videoLoaded && selectedVideo && (
              <p className="text-sm text-blue-500 mt-2">Загрузка видео...</p>
            )}
            {videoPoints.length > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={undoLastVideoPoint} className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm">
                  ↩ Отменить последнюю
                </button>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">2. Отметьте 4 точки на схеме</h3>
            <p className="text-sm text-gray-500 mb-4">
              Отмечено точек: {mapPoints.length}/4
            </p>
            <div className="border-2 border-gray-300 rounded-lg bg-white overflow-auto" style={{ maxHeight: '450px' }}>
              <canvas
                ref={dstCanvasRef}
                width={frameWidth}
                height={frameHeight}
                className="cursor-crosshair"
                style={{ maxWidth: '100%', height: 'auto', backgroundColor: '#f5f5f5' }}
                onClick={handleDstCanvasClick}
              />
            </div>
            {mapPoints.length > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={undoLastMapPoint} className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm">
                  ↩ Отменить последнюю
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <button onClick={resetAllPoints} className="px-4 py-2 bg-red-500 text-white rounded-lg">
            🗑 Сбросить всё
          </button>
          <button 
            onClick={handleSave} 
            disabled={videoPoints.length !== 4 || mapPoints.length !== 4 || isLoading} 
            className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить калибровку'}
          </button>
        </div>
        
        {error && <div className="mt-4 p-2 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          💡 Инструкция:<br />
          <strong>Шаг 1:</strong> Выберите видеофайл и укажите разрешение камеры<br />
          <strong>Шаг 2:</strong> Отметьте 4 точки на видео и 4 точки на схеме справа в одинаковом порядке
        </div>
      </div>
    </div>
  );
};

export default HomographyCalibration;