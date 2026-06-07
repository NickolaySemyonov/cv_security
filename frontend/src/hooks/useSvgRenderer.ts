import { useCallback } from 'react';
import { normalizeSvg } from '../utils/svgHelpers';

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_configured?: boolean;
}

interface Zone {
  id: number;
  type: string;
  disabled: boolean;
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
  currentFloorId: number,
  blinkingAreaId: number | null = null,
  isAdmin: boolean = true
) => {
  
  // Просто возвращаем чистую SVG карту без изменений
  const getCleanSvg = useCallback((svgContent: string): string => {
    if (!svgContent) return '';
    return normalizeSvg(svgContent);
  }, []);
  
  // Получаем данные для overlay слоя
  const getOverlayData = useCallback(() => {
    const detections = getDetectionsByFloor(currentFloorId);
    
    // Подготовка зон для отрисовки
    const zonesData = zones.map(zone => ({
      id: zone.id,
      type: zone.type,
      disabled: zone.disabled,
      cameras: zone.cameras.map(cam => ({
        id: cam.id,
        vertices: cam.visible_zone?.vertices || [],
        position: cam.position,
        isConfigured: cam.is_configured
      }))
    }));
    
    // Подготовка камер для отрисовки
    const camerasData = cameras.map(cam => ({
      id: cam.id,
      position: cam.position,
      vertices: cam.visible_zone?.vertices || [],
      isConfigured: cam.is_configured,
      isSelected: isSelectingZone && selectedCameras.has(cam.id),
      isInZone: zones.some(z => z.cameras.some(c => c.id === cam.id)),
      zoneType: zones.find(z => z.cameras.some(c => c.id === cam.id))?.type || null,
      zoneDisabled: zones.find(z => z.cameras.some(c => c.id === cam.id))?.disabled || false,
      isEditing: editingZone?.cameras.some(c => c.id === cam.id) || false
    }));
    
    // Подготовка детекций
    const detectionsData = detections.map(d => ({
      x: d.x,
      y: d.y,
      cameraId: d.cameraId,
      timestamp: d.timestamp
    }));
    
    return {
      zones: zonesData,
      cameras: camerasData,
      detections: detectionsData,
      isSelectingZone,
      blinkingAreaId,
      isAdmin
    };
  }, [cameras, zones, isSelectingZone, selectedCameras, editingZone, getDetectionsByFloor, currentFloorId, blinkingAreaId, isAdmin]);
  
  return { getCleanSvg, getOverlayData };
};