import { useState, useRef, useEffect } from 'react';

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
  editingCamera?: Camera | null;
  onSave: (cameraData: any) => void;
  onCancel: () => void;
}

const CameraDrawer = ({ svgContent, existingCameras = [], editingCamera = null, onSave, onCancel }: CameraDrawerProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [cameraPosition, setCameraPosition] = useState<Point | null>(null);
  const [isMovingCamera, setIsMovingCamera] = useState(false);
  const [tempCameraPos, setTempCameraPos] = useState<Point | null>(null);
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [showExistingHighlight, setShowExistingHighlight] = useState(true);

  // При редактировании - показываем старую область видимости, но не загружаем её для редактирования
  useEffect(() => {
    if (editingCamera) {
      // Только показываем старую область, но не загружаем для редактирования
      setShowExistingHighlight(true);
      // Не загружаем startPoint/endPoint из существующей камеры
      // Пользователь должен заново выделить область
    }
  }, [editingCamera]);

  const calculateRotation = (zoneVertices: Point[], cameraPos: Point): number => {
    if (!zoneVertices.length || !cameraPos) return 0;
    
    const centerX = zoneVertices.reduce((sum, p) => sum + p.x, 0) / zoneVertices.length;
    const centerY = zoneVertices.reduce((sum, p) => sum + p.y, 0) / zoneVertices.length;
    
    const dx = centerX - cameraPos.x;
    const dy = centerY - cameraPos.y;
    
    let angle = Math.atan2(dy, dx);
    angle = angle - Math.PI / 2;
    angle = angle + Math.PI;
    
    if (angle < 0) angle += 2 * Math.PI;
    if (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    
    return angle;
  };

  const getSVGCoordinates = (clientX: number, clientY: number): Point | null => {
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return null;
    
    try {
      const rect = svgElement.getBoundingClientRect();
      
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return null;
      }
      
      const pt = svgElement.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      
      const ctm = svgElement.getScreenCTM();
      if (!ctm) return null;
      
      const svgPoint = pt.matrixTransform(ctm.inverse());
      
      return { x: svgPoint.x, y: svgPoint.y };
    } catch (error) {
      console.error('Ошибка преобразования координат:', error);
      return null;
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // В режиме перемещения камеры по периметру
    if (isMovingCamera) {
      setIsDraggingCamera(true);
      return;
    }
    
    // Если уже есть выделенная область, не начинаем новую
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
    setShowExistingHighlight(true);
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
        rotation: rotation,
        reset_calibration: !!editingCamera
      };
      onSave(cameraData);
      setCameraPosition(null);
      setStartPoint(null);
      setEndPoint(null);
      setIsMovingCamera(false);
      setIsDraggingCamera(false);
      setTempCameraPos(null);
      setShowExistingHighlight(true);
    }
  };

  // Отрисовка иконки камеры (минималистичная)
  const renderCameraIcon = (x: number, y: number, isExisting: boolean = false, isEditing: boolean = false): string => {
    let color = '#FF4444';
    if (isEditing) {
      color = '#FF6600';
    } else if (isExisting) {
      color = '#6495ED';
    }
    
    return `
      <g transform="translate(${x - 10}, ${y - 10})">
        <circle cx="10" cy="10" r="10" fill="${color}" stroke="#fff" stroke-width="1.5" />
        <circle cx="10" cy="10" r="5" fill="#fff" />
        <circle cx="10" cy="10" r="2.5" fill="${color}" />
      </g>
    `;
  };

  // Получение SVG с существующими камерами
  const getSvgWithExistingCameras = (svg: string): string => {
    if (!svg) return '';
    
    let modifiedSvg = svg;
    
    existingCameras.forEach((camera) => {
      const isEditing = editingCamera?.id === camera.id;
      
      // Отрисовка зоны видимости существующих камер
      if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        
        if (isEditing && showExistingHighlight) {
          // Редактируемая камера - тонкая оранжевая обводка (минималистично)
          const polygon = `<polygon points="${points}" fill="rgba(255, 102, 0, 0.15)" stroke="#FF6600" stroke-width="2" stroke-dasharray="4,4" />`;
          modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
        } else {
          // Обычные камеры - светло-голубые
          const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.1)" stroke="#6495ED" stroke-width="1.5" stroke-dasharray="4,4" />`;
          modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
        }
      }
      
      // Отрисовка иконки камеры
      if (camera.position) {
        const x = camera.position.x;
        const y = camera.position.y;
        modifiedSvg = modifiedSvg.replace('</svg>', renderCameraIcon(x, y, true, isEditing && showExistingHighlight) + '</svg>');
      }
    });
    
    return modifiedSvg;
  };

  // Получение SVG с текущими рисунками
  const getSvgWithDrawings = (): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = getSvgWithExistingCameras(svgContent);
    
    // Отрисовка новой области видимости
    if (startPoint && endPoint) {
      const minX = Math.min(startPoint.x, endPoint.x);
      const minY = Math.min(startPoint.y, endPoint.y);
      const maxX = Math.max(startPoint.x, endPoint.x);
      const maxY = Math.max(startPoint.y, endPoint.y);
      const width = maxX - minX;
      const height = maxY - minY;
      
      const rectElement = `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="rgba(100,150,255,0.2)" stroke="#6495ED" stroke-width="2" stroke-dasharray="6,4" />`;
      modifiedSvg = modifiedSvg.replace('</svg>', rectElement + '</svg>');
    }
    
    // Отрисовка новой камеры
    const cameraPos = tempCameraPos || cameraPosition;
    if (cameraPos) {
      modifiedSvg = modifiedSvg.replace('</svg>', renderCameraIcon(cameraPos.x, cameraPos.y, false, false) + '</svg>');
    }
    
    return modifiedSvg;
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-200">
          {editingCamera ? `✏️ Перемещение камеры #${editingCamera.id}` : '🎥 Добавление камеры'}
        </h3>
        <div className="flex gap-2">
          {cameraPosition && !isMovingCamera && (
            <button
              onClick={startMovingCamera}
              className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors border border-yellow-500/30"
            >
              📍 Переместить камеру по периметру
            </button>
          )}
          {isMovingCamera && (
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm border border-blue-500/30">
              🔵 Зажмите ЛКМ и ведите по периметру зоны
            </span>
          )}
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={confirmCameraPosition}
            disabled={!cameraPosition}
            className="px-3 py-1 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg text-sm hover:from-green-700 hover:to-green-600 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-green-500/25"
          >
            {editingCamera ? 'Обновить камеру' : 'Сохранить камеру'}
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-400 mb-3">
        {!cameraPosition ? (
          <span className="flex items-center gap-2">
            <span className="text-red-400">🔴</span>
            {editingCamera 
              ? 'Зажмите левую кнопку мыши и растяните новый прямоугольник — это будет новая зона видимости камеры'
              : 'Зажмите левую кнопку мыши и растяните прямоугольник — это будет зона видимости камеры'
            }
          </span>
        ) : isMovingCamera ? (
          <span className="flex items-center gap-2">
            <span className="text-blue-400">🔵</span>
            Зажмите левую кнопку мыши и ведите по периметру зоны, чтобы переместить камеру
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-green-400">🟢</span>
            Зона видимости создана. Нажмите "Сохранить камеру" или переместите камеру по периметру
          </span>
        )}
      </p>
      
      {editingCamera && !cameraPosition && (
        <div className="mb-3 p-2 bg-orange-500/5 rounded-lg border border-orange-500/20">
          <p className="text-xs text-orange-400">
            🟠 Текущая зона видимости камеры #{editingCamera.id} выделена оранжевым. Нарисуйте новую область.
          </p>
        </div>
      )}
      
      <div
        ref={svgContainerRef}
        className="border border-gray-600 rounded-xl p-2 bg-gray-900/50 overflow-auto"
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