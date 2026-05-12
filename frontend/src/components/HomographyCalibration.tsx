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
  svgContent: string;
  onSave: () => void;
  onCancel: () => void;
}

const HomographyCalibration = ({ 
  cameraId, 
  cameraZone, 
  cameraPosition,
  svgContent,
  onSave, 
  onCancel 
}: HomographyCalibrationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [step, setStep] = useState<'video' | 'map'>('video');
  const [videoPoints, setVideoPoints] = useState<Point[]>([]);
  const [mapPoints, setMapPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapSvgElement, setMapSvgElement] = useState<SVGSVGElement | null>(null);

  // Запуск камеры
  useEffect(() => {
    if (step === 'video') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => setError('Не удалось получить доступ к камере'));
    }
    
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [step]);

  // Загрузка SVG карты
  useEffect(() => {
    if (step === 'map' && mapContainerRef.current && svgContent) {
      const container = mapContainerRef.current;
      container.innerHTML = svgContent;
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.pointerEvents = 'all';
        svg.style.cursor = 'crosshair';
        setMapSvgElement(svg);
        drawCameraZoneOnMap(svg);
        drawExistingMapPoints(svg);
      }
    }
  }, [step, svgContent]);

  const drawCameraZoneOnMap = (svg: SVGSVGElement) => {
    if (cameraZone.length >= 4) {
      const points = cameraZone.map(p => `${p[0]},${p[1]}`).join(' ');
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", points);
      polygon.setAttribute("fill", "rgba(100,150,255,0.3)");
      polygon.setAttribute("stroke", "#6495ED");
      polygon.setAttribute("stroke-width", "3");
      polygon.setAttribute("stroke-dasharray", "6,4");
      svg.appendChild(polygon);
    }
  };

  const drawExistingMapPoints = (svg: SVGSVGElement) => {
    mapPoints.forEach((point, i) => {
      drawPointOnMap(svg, point, i);
    });
  };

  const drawPointOnMap = (svg: SVGSVGElement, point: Point, index: number) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x.toString());
    circle.setAttribute("cy", point.y.toString());
    circle.setAttribute("r", "12");
    circle.setAttribute("fill", "#4CAF50");
    circle.setAttribute("stroke", "#fff");
    circle.setAttribute("stroke-width", "2");
    circle.classList.add("calibration-point");
    
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", point.x.toString());
    text.setAttribute("y", point.y.toString());
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("fill", "#fff");
    text.setAttribute("font-size", "14");
    text.setAttribute("font-weight", "bold");
    text.textContent = (index + 1).toString();
    text.classList.add("calibration-point");
    
    svg.appendChild(circle);
    svg.appendChild(text);
  };

  const getVideoCoords = (e: React.MouseEvent<HTMLVideoElement>): Point | null => {
    const video = videoRef.current;
    if (!video) return null;
    
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

  const getMapCoords = (e: React.MouseEvent<HTMLDivElement>): Point | null => {
    if (!mapSvgElement) return null;
    
    const rect = mapSvgElement.getBoundingClientRect();
    const scaleX = mapSvgElement.viewBox?.baseVal?.width / rect.width || 1;
    const scaleY = mapSvgElement.viewBox?.baseVal?.height / rect.height || 1;
    const viewBoxX = mapSvgElement.viewBox?.baseVal?.x || 0;
    const viewBoxY = mapSvgElement.viewBox?.baseVal?.y || 0;
    
    const x = (e.clientX - rect.left) * scaleX + viewBoxX;
    const y = (e.clientY - rect.top) * scaleY + viewBoxY;
    
    // Проверяем, что клик внутри зоны видимости
    if (!isPointInZone(x, y, cameraZone)) {
      return null;
    }
    
    return { x, y };
  };

  const isPointInZone = (x: number, y: number, zone: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
      const xi = zone[i][0], yi = zone[i][1];
      const xj = zone[j][0], yj = zone[j][1];
      const intersect = ((yi > y) != (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const drawVideoPoints = () => {
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

  useEffect(() => {
    if (step === 'video') {
      drawVideoPoints();
    }
  }, [videoPoints, step]);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (step !== 'video' || videoPoints.length >= 4) return;
    const coords = getVideoCoords(e);
    if (coords) {
      setVideoPoints([...videoPoints, coords]);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'map' || mapPoints.length >= 4) return;
    const coords = getMapCoords(e);
    if (coords && mapSvgElement) {
      const newPoints = [...mapPoints, coords];
      setMapPoints(newPoints);
      drawPointOnMap(mapSvgElement, coords, newPoints.length - 1);
    }
  };

  const handleNextStep = () => {
    if (step === 'video' && videoPoints.length === 4) {
      setStep('map');
    }
  };

  const handlePrevStep = () => {
    if (step === 'map') {
      setStep('video');
    }
  };

  const undoLastPoint = () => {
    if (step === 'video' && videoPoints.length > 0) {
      setVideoPoints(videoPoints.slice(0, -1));
    } else if (step === 'map' && mapPoints.length > 0 && mapSvgElement) {
      const newPoints = mapPoints.slice(0, -1);
      setMapPoints(newPoints);
      const oldPoints = mapSvgElement.querySelectorAll('.calibration-point');
      oldPoints.forEach(p => p.remove());
      newPoints.forEach((point, i) => drawPointOnMap(mapSvgElement, point, i));
    }
  };

  const resetAllPoints = () => {
    if (step === 'video') {
      setVideoPoints([]);
    } else if (step === 'map' && mapSvgElement) {
      setMapPoints([]);
      const oldPoints = mapSvgElement.querySelectorAll('.calibration-point');
      oldPoints.forEach(p => p.remove());
    }
  };

  const handleSave = async () => {
    if (videoPoints.length !== 4 || mapPoints.length !== 4) {
      setError('Необходимо отметить 4 точки на видео и 4 точки на карте');
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
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Прогресс-бар */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className={`text-sm font-medium ${step === 'video' ? 'text-blue-600' : 'text-gray-400'}`}>
              Шаг 1: Отметка точек на видео
            </span>
            <span className={`text-sm font-medium ${step === 'map' ? 'text-blue-600' : 'text-gray-400'}`}>
              Шаг 2: Отметка точек на карте
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: step === 'video' ? '50%' : '100%' }}
            />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">
          {step === 'video' ? 'Калибровка гомографии - Видеопоток' : 'Калибровка гомографии - Карта'}
        </h2>
        
        <p className="text-gray-600 mb-4">
          {step === 'video' ? (
            videoPoints.length < 4 
              ? `📍 Отметьте ${4 - videoPoints.length} точек на видео (углы зоны видимости)`
              : '✅ Все 4 точки отмечены! Нажмите "Далее"'
          ) : (
            mapPoints.length < 4 
              ? `📍 Отметьте ${4 - mapPoints.length} точек на карте (внутри синей зоны)`
              : '✅ Все 4 точки отмечены! Нажмите "Сохранить"'
          )}
        </p>
        
        {/* Шаг 1: Видео */}
        {step === 'video' && (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto cursor-crosshair"
              onClick={handleVideoClick}
              onLoadedMetadata={drawVideoPoints}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </div>
        )}
        
        {/* Шаг 2: Карта */}
        {step === 'map' && (
          <div 
            ref={mapContainerRef}
            className="relative bg-gray-100 rounded-lg overflow-auto"
            style={{ maxHeight: '500px', minHeight: '400px' }}
            onClick={handleMapClick}
          />
        )}
        
        {/* Индикатор прогресса */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                ${step === 'video' 
                  ? (videoPoints[i] ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500')
                  : (mapPoints[i] ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500')
                }
              `}
            >
              {i + 1}
            </div>
          ))}
        </div>
        
        {/* Кнопки управления */}
        {((step === 'video' && videoPoints.length > 0) || (step === 'map' && mapPoints.length > 0)) && (
          <div className="flex gap-2 mt-4">
            <button 
              onClick={undoLastPoint} 
              className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
            >
              ↩ Отменить последнюю
            </button>
            <button 
              onClick={resetAllPoints} 
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
        
        {/* Кнопки навигации */}
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            disabled={isLoading}
          >
            Отмена
          </button>
          {step === 'video' ? (
            <button 
              onClick={handleNextStep} 
              disabled={videoPoints.length !== 4} 
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
            >
              Далее →
            </button>
          ) : (
            <button 
              onClick={handleSave} 
              disabled={mapPoints.length !== 4 || isLoading} 
              className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50 hover:bg-green-600"
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          💡 Инструкция:<br />
          <strong>Шаг 1:</strong> Отметьте 4 точки на видео в порядке: левый верхний → правый верхний → правый нижний → левый нижний<br />
          <strong>Шаг 2:</strong> Отметьте соответствующие точки на карте <strong>ТОЛЬКО внутри синей зоны видимости</strong> в том же порядке
        </div>
      </div>
    </div>
  );
};

export default HomographyCalibration;