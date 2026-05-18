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
  cameras?: { id: number; zone: number[][] }[];
  isConnected?: boolean;
}

const DetectionOverlay = ({ svgContent, detections, cameras = [], isConnected }: DetectionOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[DETECTION_OVERLAY] detections changed:', detections);
    console.log('[DETECTION_OVERLAY] cameras:', cameras);
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
    
    cameras.forEach((camera) => {
      if (camera.zone && camera.zone.length >= 4) {
        const points = camera.zone.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.15)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" />`;
        modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
      }
    });
    
    console.log('[DETECTION_OVERLAY] Отрисовка точек:', detections.length);
    
    const detectionsByCamera: Map<number, DetectionPoint[]> = new Map();
    detections.forEach(detection => {
      if (!detectionsByCamera.has(detection.cameraId)) {
        detectionsByCamera.set(detection.cameraId, []);
      }
      detectionsByCamera.get(detection.cameraId)!.push(detection);
    });
    
    detectionsByCamera.forEach((points, cameraId) => {
      const color = getCameraColor(cameraId);
      points.forEach((detection) => {
        const camera = cameras.find(c => c.id === cameraId);
        const isInZone = camera ? isPointInZone(detection.x, detection.y, camera.zone) : true;
        const fillColor = isInZone ? color : '#FFFF44';
        
        console.log(`[DETECTION_OVERLAY] Рисуем точку: camera=${cameraId}, x=${detection.x}, y=${detection.y}, color=${fillColor}`);
        
        const circle = `
          <g transform="translate(${detection.x - 8}, ${detection.y - 8})">
            <circle cx="8" cy="8" r="8" fill="${fillColor}" stroke="#fff" stroke-width="2" />
            <circle cx="8" cy="8" r="3" fill="#fff" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
          </g>
        `;
        modifiedSvg = modifiedSvg.replace('</svg>', circle + '</svg>');
      });
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