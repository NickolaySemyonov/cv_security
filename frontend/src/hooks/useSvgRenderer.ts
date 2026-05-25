// hooks/useSvgRenderer.ts
import { useCallback } from 'react';
import { normalizeSvg, getViewBox } from '../utils/svgHelpers';

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_configured?: boolean;
}

interface Zone {
  id: number;
  type: string;
  red_zone: boolean;
  floor_id: number;
  cameras: Camera[];
}

interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

export const useSvgRenderer = (
  cameras: Camera[], 
  zones: Zone[], 
  isSelectingZone: boolean, 
  selectedCameras: Set<number>, 
  editingZone: Zone | null,
  getDetectionsByFloor: (floorId: number) => DetectionPoint[],
  currentFloorId: number
) => {
  
  const getZoneOfCamera = useCallback((cameraId: number): Zone | undefined => 
    zones.find(zone => zone.cameras.some(cam => cam.id === cameraId)), [zones]);
  
  const getZoneStyle = (camera: Camera, isSelected: boolean, isInZone: boolean, cameraZone: Zone | null) => {
    if (isSelectingZone) {
      if (isSelected) return { fill: 'rgba(0, 255, 255, 0.4)', stroke: '#00FFFF', width: '4' };
      if (isInZone && !editingZone) return { fill: 'rgba(128, 128, 128, 0.2)', stroke: '#888888', width: '2' };
      return { fill: 'rgba(255, 255, 0, 0.2)', stroke: '#FFAA00', width: '2' };
    }
    if (isInZone) {
      return { fill: 'rgba(100,150,255,0.1)', stroke: cameraZone?.type === 'red' ? '#FF6666' : '#66FF66', width: '2' };
    }
    return { fill: 'rgba(100,150,255,0.15)', stroke: '#6495ED', width: '2' };
  };
  
  const renderCameraZone = (camera: Camera, style: { fill: string; stroke: string; width: string }, isSelectable: boolean): string => {
    if (!camera.visible_zone?.vertices?.length) return '';
    const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
    const attrs = `points="${points}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.width}" stroke-dasharray="4,4"`;
    const selectable = isSelectable ? ` class="selectable-zone" data-camera-id="${camera.id}" style="cursor:pointer"` : '';
    return `<polygon ${attrs}${selectable} />`;
  };
  
  const renderCameraIcon = (camera: Camera, isSelectable: boolean, isSelected: boolean): string => {
    if (!camera.position) return '';
    const color = isSelectingZone ? (isSelected ? '#00FFFF' : '#000000') : '#000000';
    const selectable = isSelectable ? ` class="selectable-camera" data-camera-id="${camera.id}" style="cursor:pointer"` : '';
    return `<g transform="translate(${camera.position.x - 12}, ${camera.position.y - 12})"${selectable}>
      <circle cx="12" cy="12" r="12" fill="${color}" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="12" cy="12" r="6" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="3" fill="${color}" />
    </g>`;
  };
  
  const renderZoneBackground = (zone: Zone): string => {
    const color = zone.type === 'red' ? 'rgba(255, 80, 80, 0.35)' : 'rgba(80, 255, 80, 0.35)';
    const strokeColor = zone.type === 'red' ? '#FF4444' : '#44FF44';
    
    let result = '';
    zone.cameras.forEach((camera) => {
      if (camera.visible_zone?.vertices?.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        result += `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="3" stroke-dasharray="6,4" />`;
      }
    });
    return result;
  };
  
  const renderDetectionPoint = (detection: DetectionPoint, viewBox: { x: number; y: number; width: number; height: number }): string => {
    const isInViewBox = detection.x >= viewBox.x && detection.x <= viewBox.x + viewBox.width &&
                        detection.y >= viewBox.y && detection.y <= viewBox.y + viewBox.height;
    if (!isInViewBox) return '';
    
    return `<g transform="translate(${detection.x - 8}, ${detection.y - 8})">
      <circle cx="8" cy="8" r="8" fill="#000000" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="8" cy="8" r="3" fill="#FFFFFF" />
      <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
    </g>`;
  };
  
  const getSvgWithAllElements = (svgContent: string): string => {
    if (!svgContent) return '';
    
    let modifiedSvg = normalizeSvg(svgContent);
    const configuredCameras = cameras.filter(c => c.is_configured === true);
    const viewBox = getViewBox(modifiedSvg);
    
    // Рисуем фоновые зоны
    zones.forEach(zone => {
      const zoneHtml = renderZoneBackground(zone);
      if (zoneHtml) {
        modifiedSvg = modifiedSvg.replace('</svg>', zoneHtml + '</svg>');
      }
    });
    
    // Рисуем камеры и их зоны видимости
    configuredCameras.forEach((camera) => {
      const cameraZone = getZoneOfCamera(camera.id);
      const isInZone = !!cameraZone;
      const isSelected = isSelectingZone && selectedCameras.has(camera.id);
      const style = getZoneStyle(camera, isSelected, isInZone, cameraZone || null);
      const isSelectable = isSelectingZone && !(isInZone && !editingZone);
      
      if (camera.visible_zone?.vertices?.length) {
        const zoneHtml = renderCameraZone(camera, style, isSelectable);
        if (zoneHtml) {
          modifiedSvg = modifiedSvg.replace('</svg>', zoneHtml + '</svg>');
        }
      }
      
      const iconHtml = renderCameraIcon(camera, isSelectable, isSelected);
      if (iconHtml) {
        modifiedSvg = modifiedSvg.replace('</svg>', iconHtml + '</svg>');
      }
    });
    
    // Рисуем точки детекции
    const detections = getDetectionsByFloor(currentFloorId);
    detections.forEach(detection => {
      const pointHtml = renderDetectionPoint(detection, viewBox);
      if (pointHtml) {
        modifiedSvg = modifiedSvg.replace('</svg>', pointHtml + '</svg>');
      }
    });
    
    return modifiedSvg;
  };
  
  return { getSvgWithAllElements };
};