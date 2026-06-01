import { useCallback, useRef } from 'react';
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
  disabled: boolean;
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
  currentFloorId: number,
  blinkingAreaId: number | null = null,
  isAdmin: boolean = true
) => {
  
  const svgCacheRef = useRef<Map<string, string>>(new Map());
  const lastDetectionsRef = useRef<string>('');
  
  const getZoneOfCamera = useCallback((cameraId: number): Zone | undefined => 
    zones.find(zone => zone.cameras.some(cam => cam.id === cameraId)), [zones]);
  
  const getZoneStyle = useCallback((camera: Camera, isSelected: boolean, isInZone: boolean, cameraZone: Zone | null) => {
    if (cameraZone?.disabled) {
      return { fill: 'rgba(34, 139, 34, 0.5)', stroke: '#228B22', width: '3' };
    }
    
    if (isSelectingZone) {
      if (isSelected) return { fill: 'rgba(0, 255, 255, 0.4)', stroke: '#00FFFF', width: '4' };
      if (isInZone && !editingZone) return { fill: 'rgba(128, 128, 128, 0.2)', stroke: '#888888', width: '2' };
      return { fill: 'rgba(255, 255, 0, 0.2)', stroke: '#FFAA00', width: '2' };
    }
    if (isInZone) {
      if (cameraZone?.disabled) {
        return { fill: 'rgba(34, 139, 34, 0.4)', stroke: '#228B22', width: '3' };
      }
      return { 
        fill: cameraZone?.type === 'red' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.3)', 
        stroke: cameraZone?.type === 'red' ? '#EF4444' : '#22C55E', 
        width: '2' 
      };
    }
    return { fill: 'rgba(100,150,255,0.15)', stroke: '#6495ED', width: '2' };
  }, [isSelectingZone, editingZone]);
  
  const renderCameraZone = useCallback((camera: Camera, style: { fill: string; stroke: string; width: string }, isSelectable: boolean): string => {
    if (!camera.visible_zone?.vertices?.length) return '';
    const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
    const attrs = `points="${points}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.width}" stroke-dasharray="4,4"`;
    const selectable = isSelectable ? ` class="selectable-zone" data-camera-id="${camera.id}" style="cursor:pointer"` : '';
    return `<polygon ${attrs}${selectable} />`;
  }, []);
  
  const renderCameraIcon = useCallback((camera: Camera, isSelectable: boolean, isSelected: boolean): string => {
    if (!camera.position) return '';
    const x = camera.position.x;
    const y = camera.position.y;
    
    let cameraColor = '#FF4444';
    let borderColor = '#FFFFFF';
    let additionalClass = '';
    let cursorStyle = isAdmin ? 'cursor:pointer' : 'cursor:default';
    let hoverEffect = '';
    
    if (isSelectingZone) {
      additionalClass = 'selectable-camera';
      if (isSelected) {
        cameraColor = '#00FFFF';
      } else {
        cameraColor = '#333333';
      }
    } else if (isAdmin) {
      additionalClass = 'clickable-camera';
      hoverEffect = `
        <style>
          .camera-icon-${camera.id}:hover circle:first-child {
            filter: drop-shadow(0 0 8px rgba(255, 68, 68, 0.8));
            transition: filter 0.2s ease;
          }
          .camera-icon-${camera.id}:hover circle:last-child {
            transform: scale(1.2);
            transition: transform 0.2s ease;
          }
        </style>
      `;
    }
    
    return `
      ${hoverEffect}
      <g transform="translate(${x - 16}, ${y - 16})" 
         class="camera-icon-${camera.id} ${additionalClass}" 
         data-camera-id="${camera.id}" 
         style="${cursorStyle}">
        <rect x="2" y="8" width="28" height="16" rx="3" fill="${cameraColor}" stroke="${borderColor}" stroke-width="1.5" />
        <circle cx="16" cy="16" r="7" fill="#1a1a1a" stroke="${borderColor}" stroke-width="1" />
        <circle cx="16" cy="16" r="4" fill="#333333" />
        <circle cx="16" cy="16" r="2" fill="#666666" />
        <circle cx="14" cy="14" r="1" fill="#ffffff" opacity="0.8" />
        <rect x="14" y="0" width="4" height="8" rx="1" fill="${cameraColor}" stroke="${borderColor}" stroke-width="1" />
        <circle cx="26" cy="12" r="1.5" fill="#ff0000" opacity="0.8" />
      </g>
    `;
  }, [isSelectingZone, isAdmin]);
  
  const renderZoneBackground = useCallback((zone: Zone): string => {
    if (zone.disabled) {
      const color = 'rgba(34, 139, 34, 0.5)';
      const strokeColor = '#228B22';
      let result = '';
      zone.cameras.forEach((camera) => {
        if (camera.visible_zone?.vertices?.length >= 4) {
          const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
          result += `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="3" stroke-dasharray="6,4" />`;
        }
      });
      return result;
    }
    
    // Проверяем, мигает ли эта зона
    const isBlinking = blinkingAreaId !== null && blinkingAreaId === zone.id;
    
    // Для мигающей зоны используем ярко-красный цвет с анимацией
    let color, strokeColor, strokeWidth, animation;
    
    if (isBlinking) {
      // Мигающая зона - ярко-красная
      color = 'rgba(255, 0, 0, 0.8)';
      strokeColor = '#FF0000';
      strokeWidth = '4';
      animation = 'animation: blink 0.8s ease-in-out infinite;';
    } else if (zone.type === 'red') {
      // Обычная красная зона
      color = 'rgba(239, 68, 68, 0.35)';
      strokeColor = '#EF4444';
      strokeWidth = '3';
      animation = '';
    } else {
      // Зелёная зона
      color = 'rgba(34, 197, 94, 0.3)';
      strokeColor = '#22C55E';
      strokeWidth = '3';
      animation = '';
    }
    
    let result = '';
    if (isBlinking) {
      result += `
        <style>
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        </style>
      `;
    }
    
    zone.cameras.forEach((camera) => {
      if (camera.visible_zone?.vertices?.length >= 4) {
        const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
        result += `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="6,4" style="${animation}" />`;
      }
    });
    return result;
  }, [blinkingAreaId]);
  
  const renderDetectionPoints = useCallback((detections: DetectionPoint[], viewBox: { x: number; y: number; width: number; height: number }): string => {
    if (!detections.length) return '';
    
    let pointsHtml = '';
    detections.forEach(detection => {
      const isInViewBox = detection.x >= viewBox.x && detection.x <= viewBox.x + viewBox.width &&
                          detection.y >= viewBox.y && detection.y <= viewBox.y + viewBox.height;
      if (isInViewBox) {
        pointsHtml += `<g transform="translate(${detection.x - 8}, ${detection.y - 8})">
          <circle cx="8" cy="8" r="8" fill="#FF4444" stroke="#FFFFFF" stroke-width="2" />
          <circle cx="8" cy="8" r="3" fill="#FFFFFF" />
        </g>`;
      }
    });
    return pointsHtml;
  }, []);
  
  const getBaseSvg = useCallback((svgContent: string): string => {
    // Ключ кэша включает blinkingAreaId для перерисовки при мигании
    const cacheKey = `${svgContent}_${cameras.length}_${zones.length}_${isSelectingZone}_${blinkingAreaId}`;
    
    if (svgCacheRef.current.has(cacheKey)) {
      return svgCacheRef.current.get(cacheKey)!;
    }
    
    if (!svgContent) return '';
    
    let modifiedSvg = normalizeSvg(svgContent);
    const configuredCameras = cameras.filter(c => c.is_configured === true);
    
    zones.forEach(zone => {
      const zoneHtml = renderZoneBackground(zone);
      if (zoneHtml) {
        modifiedSvg = modifiedSvg.replace('</svg>', zoneHtml + '</svg>');
      }
    });
    
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
    
    svgCacheRef.current.set(cacheKey, modifiedSvg);
    
    if (svgCacheRef.current.size > 10) {
      const firstKey = svgCacheRef.current.keys().next().value;
      svgCacheRef.current.delete(firstKey);
    }
    
    return modifiedSvg;
  }, [cameras, zones, isSelectingZone, selectedCameras, editingZone, blinkingAreaId, getZoneOfCamera, getZoneStyle, renderCameraZone, renderCameraIcon, renderZoneBackground]);
  
  const getSvgWithAllElements = useCallback((svgContent: string): string => {
    const baseSvg = getBaseSvg(svgContent);
    if (!baseSvg) return '';
    
    const detections = getDetectionsByFloor(currentFloorId);
    const detectionsKey = JSON.stringify(detections.map(d => `${d.x},${d.y}`));
    
    if (lastDetectionsRef.current === detectionsKey && baseSvg.includes('<!--detections-placeholder-->')) {
      return baseSvg;
    }
    
    lastDetectionsRef.current = detectionsKey;
    const viewBox = getViewBox(baseSvg);
    const pointsHtml = renderDetectionPoints(detections, viewBox);
    
    if (baseSvg.includes('<!--detections-placeholder-->')) {
      return baseSvg.replace('<!--detections-placeholder-->', pointsHtml);
    }
    
    const svgEndIndex = baseSvg.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return baseSvg;
    
    return baseSvg.slice(0, svgEndIndex) + pointsHtml + baseSvg.slice(svgEndIndex);
  }, [getBaseSvg, getDetectionsByFloor, currentFloorId, renderDetectionPoints]);
  
  return { getSvgWithAllElements };
};