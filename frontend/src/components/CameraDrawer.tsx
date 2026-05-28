import { useState, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_configured?: boolean;
}

interface CameraDrawerProps {
  svgContent: string;
  existingCameras?: Camera[];
  onSave: (cameraData: any) => void;
  onCancel: () => void;
}

const CameraDrawer = ({ svgContent, existingCameras = [], onSave, onCancel }: CameraDrawerProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [cameraPosition, setCameraPosition] = useState<Point | null>(null);
  const [isMovingCamera, setIsMovingCamera] = useState(false);
  const [tempCameraPos, setTempCameraPos] = useState<Point | null>(null);
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);

  // Расчёт угла: 0 радиан = камера снизу (смотрит вверх)
  const calculateRotation = (zoneVertices: Point[], cameraPos: Point): number => {
    if (!zoneVertices.length || !cameraPos) return 0;
    
    const centerX = zoneVertices.reduce((sum, p) => sum + p.x, 0) / zoneVertices.length;
    const centerY = zoneVertices.reduce((sum, p) => sum + p.y, 0) / zoneVertices.length;
    
    // Вектор от камеры к центру
    const dx = centerX - cameraPos.x;
    const dy = centerY - cameraPos.y;
    
    // Стандартный угол (0 = вправо)
    let angle = Math.atan2(dy, dx);
    
    // Преобразуем: 0 радиан = снизу (смотрит вверх)
    angle = angle - Math.PI / 2;
    
    // Добавляем поворот на 180° (π) перед сохранением в БД
    angle = angle + Math.PI;
    
    // Нормализуем в диапазон 0 - 2π
    if (angle < 0) angle += 2 * Math.PI;
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    
    return angle;
  };

  const getSVGCoordinates = (clientX: number, clientY: number): Point | null => {
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return null;
    
    const rect = svgElement.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    return { x, y };
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMovingCamera) {
      setIsDraggingCamera(true);
      return;
    }
    
    if (cameraPosition) return;
    
    const point = getSVGCoordinates(event.clientX, event.clientY);
    if (point) {
      setIsDrawing(true);
      setStartPoint(point);
      setEndPoint(point);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMovingCamera && isDraggingCamera) {
      const point = getSVGCoordinates(event.clientX, event.clientY);
      if (point && startPoint && endPoint) {
        updateCameraPositionOnPerimeter(point);
      }
      return;
    }
    
    if (!isDrawing) return;
    
    const point = getSVGCoordinates(event.clientX, event.clientY);
    if (point) {
      setEndPoint(point);
    }
  };

  const handleMouseUp = () => {
    if (isMovingCamera && isDraggingCamera) {
      if (tempCameraPos) {
        setCameraPosition(tempCameraPos);
        setTempCameraPos(null);
      }
      setIsDraggingCamera(false);
      setIsMovingCamera(false);
      return;
    }
    
    if (!isDrawing) return;
    
    setIsDrawing(false);
    if (startPoint && endPoint) {
      const zone = createRectangle(startPoint, endPoint);
      const cameraPos = getCameraPositionOnPerimeter(zone);
      setCameraPosition(cameraPos);
    }
  };

  const createRectangle = (p1: Point, p2: Point): Point[] => {
    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);
    
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  };

  const getClosestSidePoint = (zone: Point[], mousePoint: Point): Point => {
    const minX = Math.min(...zone.map(p => p.x));
    const maxX = Math.max(...zone.map(p => p.x));
    const minY = Math.min(...zone.map(p => p.y));
    const maxY = Math.max(...zone.map(p => p.y));
    
    const candidates = [
      { x: Math.min(maxX, Math.max(minX, mousePoint.x)), y: minY },
      { x: Math.min(maxX, Math.max(minX, mousePoint.x)), y: maxY },
      { x: minX, y: Math.min(maxY, Math.max(minY, mousePoint.y)) },
      { x: maxX, y: Math.min(maxY, Math.max(minY, mousePoint.y)) }
    ];
    
    let closest = candidates[0];
    let minDist = Math.hypot(closest.x - mousePoint.x, closest.y - mousePoint.y);
    
    for (const candidate of candidates) {
      const dist = Math.hypot(candidate.x - mousePoint.x, candidate.y - mousePoint.y);
      if (dist < minDist) {
        minDist = dist;
        closest = candidate;
      }
    }
    
    return closest;
  };

  const getCameraPositionOnPerimeter = (zone: Point[]): Point => {
    const minX = Math.min(...zone.map(p => p.x));
    const maxX = Math.max(...zone.map(p => p.x));
    const minY = Math.min(...zone.map(p => p.y));
    const maxY = Math.max(...zone.map(p => p.y));
    
    return { x: (minX + maxX) / 2, y: minY };
  };

  const updateCameraPositionOnPerimeter = (mousePoint: Point) => {
    if (!startPoint || !endPoint) return;
    
    const zone = createRectangle(startPoint, endPoint);
    const newPos = getClosestSidePoint(zone, mousePoint);
    setTempCameraPos(newPos);
  };

  const startMovingCamera = () => {
    setIsMovingCamera(true);
    setIsDraggingCamera(false);
  };

  const handleCancel = () => {
    setCameraPosition(null);
    setStartPoint(null);
    setEndPoint(null);
    setIsMovingCamera(false);
    setIsDraggingCamera(false);
    setTempCameraPos(null);
    onCancel();
  };

  const confirmCameraPosition = () => {
    if (cameraPosition && startPoint && endPoint) {
      const zone = createRectangle(startPoint, endPoint);
      const rotation = calculateRotation(zone, cameraPosition);
      
      const cameraData = {
        position: { x: cameraPosition.x, y: cameraPosition.y },
        visible_zone: { vertices: zone.map(p => [p.x, p.y]) },
        points_of_homography: null,
        is_configured: false,
        rotation: rotation
      };
      onSave(cameraData);
      setCameraPosition(null);
      setStartPoint(null);
      setEndPoint(null);
      setIsMovingCamera(false);
      setIsDraggingCamera(false);
      setTempCameraPos(null);
    }
  };

  const renderCameraIcon = (x: number, y: number, isExisting: boolean = false): string => {
    return `
      <g transform="translate(${x - 14}, ${y - 14})">
        <circle cx="14" cy="14" r="14" fill="${isExisting ? '#888888' : '#FF4444'}" stroke="#fff" stroke-width="2" />
        <circle cx="14" cy="14" r="7" fill="#fff" />
        <circle cx="14" cy="14" r="3" fill="${isExisting ? '#888888' : '#FF4444'}" />
      </g>
    `;
  };

  const getSvgWithExistingCameras = (svgContent: string): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = svgContent;
    
    existingCameras.forEach((camera) => {
      if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.1)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
      
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        modifiedSvg = modifiedSvg.replace('</svg>', renderCameraIcon(x, y, true) + '</svg>');
      }
    });
    
    return modifiedSvg;
  };

  const getSvgWithDrawings = (): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = getSvgWithExistingCameras(svgContent);
    
    if (startPoint && endPoint) {
      const minX = Math.min(startPoint.x, endPoint.x);
      const minY = Math.min(startPoint.y, endPoint.y);
      const maxX = Math.max(startPoint.x, endPoint.x);
      const maxY = Math.max(startPoint.y, endPoint.y);
      const width = maxX - minX;
      const height = maxY - minY;
      
      const rectElement = `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="rgba(100,150,255,0.3)" stroke="#6495ED" stroke-width="3" stroke-dasharray="6,4" />`;
      modifiedSvg = modifiedSvg.replace('</svg>', rectElement + '</svg>');
    }
    
    const cameraPos = tempCameraPos || cameraPosition;
    if (cameraPos) {
      modifiedSvg = modifiedSvg.replace('</svg>', renderCameraIcon(cameraPos.x, cameraPos.y, false) + '</svg>');
    }
    
    return modifiedSvg;
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          🎥 Добавление камеры
        </h3>
        <div className="flex gap-2">
          {cameraPosition && !isMovingCamera && (
            <button
              onClick={startMovingCamera}
              className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
            >
              ✨ Переместить камеру
            </button>
          )}
          {isMovingCamera && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
              🔵 Зажмите ЛКМ и ведите по периметру
            </span>
          )}
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600"
          >
            Отмена
          </button>
          <button
            onClick={confirmCameraPosition}
            disabled={!cameraPosition}
            className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
          >
            Сохранить камеру
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3">
        {!cameraPosition ? (
          <span>🔴 Зажмите левую кнопку мыши и растяните прямоугольник — это будет зона видимости камеры</span>
        ) : isMovingCamera ? (
          <span>🔵 Зажмите левую кнопку мыши и ведите по периметру зоны, чтобы переместить камеру</span>
        ) : (
          <span>🟢 Зона видимости создана. Нажмите "Сохранить камеру"</span>
        )}
      </p>
      
      <div
        ref={svgContainerRef}
        className="border rounded-lg p-2 bg-gray-50 overflow-auto"
        style={{ cursor: isDrawing || (isMovingCamera && isDraggingCamera) ? 'crosshair' : 'default', minHeight: '500px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          dangerouslySetInnerHTML={{ __html: getSvgWithDrawings() }}
          className="inline-block"
        />
      </div>
    </div>
  );
};

export default CameraDrawer;