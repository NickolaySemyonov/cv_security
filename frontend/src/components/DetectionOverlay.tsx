import { useRef, useEffect } from 'react';

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

interface DetectionOverlayProps {
  svgContent: string;
  detections: DetectionPoint[];
  cameras?: { id: number; zone: number[][]; rotation?: number; frame_shape?: { width: number; height: number } }[];
  isConnected?: boolean;
}

const DetectionOverlay = ({ svgContent, detections, cameras = [], isConnected }: DetectionOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  }, [detections, cameras]);

  const getCameraColor = (cameraId: number): string => {
    const colors = ['#FF4444', '#44FF44', '#FFA500', '#FF00FF', '#00FFFF', '#FFFF00'];
    return colors[cameraId % colors.length];
  };

  const isPointInZone = (x: number, y: number, zone: number[][]): boolean => {
    if (!zone || zone.length < 4) return true;
    let inside = false;
    for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
      const xi = zone[i][0], yi = zone[i][1];
      const xj = zone[j][0], yj = zone[j][1];
      const intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const getSvgWithDetections = (svg: string): string => {
    if (!svg) return '';
    
    let modifiedSvg = svg;
    
    // Рисуем зоны видимости камер
    cameras.forEach((camera) => {
      if (camera.zone && camera.zone.length >= 4) {
        const points = camera.zone.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.15)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
    });
    
    // Отрисовываем точки детекции
    detections.forEach((detection, idx) => {
      const x = detection.x;
      const y = detection.y;
            
      const camera = cameras.find(c => c.id === detection.cameraId);
      const color = getCameraColor(detection.cameraId);
      const isInZone = camera ? isPointInZone(x, y, camera.zone) : true;
      const fillColor = isInZone ? color : '#FFFF44';
      
      const circle = `
        <g transform="translate(${x - 8}, ${y - 8})">
          <circle cx="8" cy="8" r="8" fill="${fillColor}" stroke="#fff" stroke-width="2" />
          <circle cx="8" cy="8" r="3" fill="#fff" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </g>
      `;
      modifiedSvg = modifiedSvg.replace('</svg>', circle + '</svg>');
    });
    
    return modifiedSvg;
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: getSvgWithDetections(svgContent) }}
      />
    </div>
  );
};

export default DetectionOverlay;