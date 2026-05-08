// frontend/src/components/CameraDrawer.tsx
import { useState, useRef, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

interface CameraDrawerProps {
  svgContent: string;
  onSave: (cameraData: { position: Point; zone: Point[] }) => void;
  onCancel: () => void;
}

const CameraDrawer = ({ svgContent, onSave, onCancel }: CameraDrawerProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [cameraPosition, setCameraPosition] = useState<Point | null>(null);
  const [isMovingCamera, setIsMovingCamera] = useState(false);
  const [tempCameraPos, setTempCameraPos] = useState<Point | null>(null);
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);

  // Получение координат клика относительно SVG
  const getSVGCoordinates = (event: React.MouseEvent<HTMLDivElement>): Point | null => {
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return null;
    
    const rect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox?.baseVal;
    const scaleX = viewBox ? viewBox.width / rect.width : 1;
    const scaleY = viewBox ? viewBox.height / rect.height : 1;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  // Начало рисования зоны
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMovingCamera) {
      // Если в режиме перемещения камеры, начинаем перетаскивание
      setIsDraggingCamera(true);
      return;
    }
    
    if (cameraPosition) return;
    
    const point = getSVGCoordinates(event);
    if (point) {
      setIsDrawing(true);
      setStartPoint(point);
      setEndPoint(point);
    }
  };

  // Рисование зоны или перемещение камеры
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    // Перемещение камеры при зажатой кнопке
    if (isMovingCamera && isDraggingCamera) {
      const point = getSVGCoordinates(event);
      if (point && startPoint && endPoint) {
        updateCameraPositionOnPerimeter(point);
      }
      return;
    }
    
    // Рисование прямоугольника
    if (!isDrawing) return;
    
    const point = getSVGCoordinates(event);
    if (point) {
      setEndPoint(point);
    }
  };

  // Завершение рисования зоны или перемещения камеры
  const handleMouseUp = () => {
    // Завершение перемещения камеры
    if (isMovingCamera && isDraggingCamera) {
      if (tempCameraPos) {
        setCameraPosition(tempCameraPos);
        setTempCameraPos(null);
      }
      setIsDraggingCamera(false);
      setIsMovingCamera(false); // Выходим из режима перемещения после фиксации
      return;
    }
    
    // Завершение рисования зоны
    if (!isDrawing) return;
    
    setIsDrawing(false);
    if (startPoint && endPoint) {
      const zone = createRectangle(startPoint, endPoint);
      const cameraPos = getCameraPositionOnPerimeter(zone);
      setCameraPosition(cameraPos);
    }
  };

  // Создание прямоугольника по двум точкам
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

  // Определение стороны, на которой находится камера
  const getCameraSide = (zone: Point[], mousePoint: Point): string => {
    const minX = Math.min(...zone.map(p => p.x));
    const maxX = Math.max(...zone.map(p => p.x));
    const minY = Math.min(...zone.map(p => p.y));
    const maxY = Math.max(...zone.map(p => p.y));
    
    const distToTop = Math.abs(mousePoint.y - minY);
    const distToBottom = Math.abs(mousePoint.y - maxY);
    const distToLeft = Math.abs(mousePoint.x - minX);
    const distToRight = Math.abs(mousePoint.x - maxX);
    
    const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
    
    if (minDist === distToTop) return 'top';
    if (minDist === distToBottom) return 'bottom';
    if (minDist === distToLeft) return 'left';
    return 'right';
  };

  // Получение позиции камеры на периметре
  const getCameraPositionOnPerimeter = (zone: Point[]): Point => {
    const minX = Math.min(...zone.map(p => p.x));
    const maxX = Math.max(...zone.map(p => p.x));
    const minY = Math.min(...zone.map(p => p.y));
    const maxY = Math.max(...zone.map(p => p.y));
    
    return { x: (minX + maxX) / 2, y: minY };
  };

  // Обновление позиции камеры при движении мыши по периметру
  const updateCameraPositionOnPerimeter = (mousePoint: Point) => {
    if (!startPoint || !endPoint) return;
    
    const zone = createRectangle(startPoint, endPoint);
    const minX = Math.min(...zone.map(p => p.x));
    const maxX = Math.max(...zone.map(p => p.x));
    const minY = Math.min(...zone.map(p => p.y));
    const maxY = Math.max(...zone.map(p => p.y));
    
    const side = getCameraSide(zone, mousePoint);
    
    let newPos: Point = { x: 0, y: 0 };
    switch (side) {
      case 'top':
        newPos = { x: Math.min(maxX, Math.max(minX, mousePoint.x)), y: minY };
        break;
      case 'bottom':
        newPos = { x: Math.min(maxX, Math.max(minX, mousePoint.x)), y: maxY };
        break;
      case 'left':
        newPos = { x: minX, y: Math.min(maxY, Math.max(minY, mousePoint.y)) };
        break;
      case 'right':
        newPos = { x: maxX, y: Math.min(maxY, Math.max(minY, mousePoint.y)) };
        break;
    }
    
    setTempCameraPos(newPos);
  };

  // Начать перемещение камеры
  const startMovingCamera = () => {
    setIsMovingCamera(true);
    setIsDraggingCamera(false);
  };

  // Отмена (выход без сохранения)
  const handleCancel = () => {
    setCameraPosition(null);
    setStartPoint(null);
    setEndPoint(null);
    setIsMovingCamera(false);
    setIsDraggingCamera(false);
    setTempCameraPos(null);
    onCancel();
  };

  // Сохранение камеры
  const confirmCameraPosition = () => {
    if (cameraPosition && startPoint && endPoint) {
      const zone = createRectangle(startPoint, endPoint);
      onSave({ position: cameraPosition, zone });
      // Сброс состояния
      setCameraPosition(null);
      setStartPoint(null);
      setEndPoint(null);
      setIsMovingCamera(false);
      setIsDraggingCamera(false);
      setTempCameraPos(null);
    }
  };

  // Генерация SVG с отрисованными элементами
  const getSvgWithDrawings = (): string => {
    if (!svgContent) return '';
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return svgContent;
    
    let drawings = '';
    
    // Рисуем зону видимости
    if (startPoint && endPoint) {
      const zone = createRectangle(startPoint, endPoint);
      const minX = Math.min(...zone.map(p => p.x));
      const maxX = Math.max(...zone.map(p => p.x));
      const minY = Math.min(...zone.map(p => p.y));
      const maxY = Math.max(...zone.map(p => p.y));
      const width = maxX - minX;
      const height = maxY - minY;
      
      drawings += `
        <rect
          x="${minX}" y="${minY}"
          width="${width}" height="${height}"
          fill="rgba(100, 150, 255, 0.2)"
          stroke="#6495ED"
          stroke-width="2"
          stroke-dasharray="5,5"
        />
      `;
    }
    
    // Рисуем камеру (временную или финальную)
    const cameraPos = tempCameraPos || cameraPosition;
    if (cameraPos) {
      drawings += `
        <g transform="translate(${cameraPos.x - 12}, ${cameraPos.y - 12})">
          <circle cx="12" cy="12" r="12" fill="#FF4444" stroke="#fff" stroke-width="2" />
          <circle cx="12" cy="12" r="6" fill="#fff" />
          <circle cx="12" cy="12" r="3" fill="#FF4444" />
          <line x1="20" y1="20" x2="28" y2="28" stroke="#FF4444" stroke-width="2" />
        </g>
      `;
    }
    
    return svgContent.slice(0, svgEndIndex) + drawings + svgContent.slice(svgEndIndex);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
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
          <span>🔵 Зажмите левую кнопку мыши и ведите по периметру зоны, чтобы переместить камеру. Отпустите кнопку для фиксации</span>
        ) : (
          <span>🟢 Зона видимости создана. Нажмите "Переместить камеру", чтобы изменить её положение, или "Сохранить" для добавления</span>
        )}
      </p>
      
      <div
        ref={svgContainerRef}
        className="border rounded-lg p-2 bg-gray-50 overflow-auto"
        style={{ cursor: isDrawing || (isMovingCamera && isDraggingCamera) ? 'crosshair' : 'default' }}
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