import React, { useRef, useEffect, useState } from 'react';

interface Camera {
  id: number;
  position: { x: number; y: number };
  vertices: number[][];
  isConfigured: boolean;
  isSelected: boolean;
  isInZone: boolean;
  zoneType: string | null;
  zoneDisabled: boolean;
  isEditing: boolean;
}

interface Zone {
  id: number;
  type: string;
  disabled: boolean;
  cameras: Array<{
    id: number;
    vertices: number[][];
    position: { x: number; y: number };
  }>;
}

interface Detection {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}

interface FloorOverlayProps {
  svgContainerRef: React.RefObject<HTMLDivElement>;
  zones: Zone[];
  cameras: Camera[];
  detections: Detection[];
  isSelectingZone: boolean;
  blinkingZones?: Set<number>;
  highlightedZoneId?: number | null;
  highlightIntensity?: number;
  isAdmin: boolean;
  onZoneClick?: (zoneId: number) => void;
  onCameraClick?: (cameraId: number) => void;
  onSelectableClick?: (cameraId: number) => void;
}

const FloorOverlay: React.FC<FloorOverlayProps> = ({
  svgContainerRef,
  zones,
  cameras,
  detections,
  isSelectingZone,
  blinkingZones = new Set(),
  highlightedZoneId = null,
  highlightIntensity = 0,
  isAdmin,
  onZoneClick,
  onCameraClick,
  onSelectableClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [hoveredZoneId, setHoveredZoneId] = useState<number | null>(null);
  const [hoveredCameraId, setHoveredCameraId] = useState<number | null>(null);

  // Получаем трансформацию для конвертации SVG координат в canvas
  const getTransform = () => {
    const container = svgContainerRef.current;
    const svg = container?.querySelector('svg');
    if (!container || !svg) return null;

    const svgRect = svg.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;

    let viewBox = { x: 0, y: 0, width: 800, height: 600 };
    const viewBoxAttr = svg.getAttribute('viewBox');
    if (viewBoxAttr) {
      const [x, y, width, height] = viewBoxAttr.split(' ').map(Number);
      viewBox = { x, y, width, height };
    } else {
      const width = parseFloat(svg.getAttribute('width') || '800');
      const height = parseFloat(svg.getAttribute('height') || '600');
      viewBox = { x: 0, y: 0, width, height };
    }

    const scaleX = svgRect.width / viewBox.width;
    const scaleY = svgRect.height / viewBox.height;
    const offsetX = svgRect.left - canvasRect.left;
    const offsetY = svgRect.top - canvasRect.top;

    return { scaleX, scaleY, offsetX, offsetY, viewBox };
  };

  // Конвертация SVG координат в canvas
  const svgToCanvas = (x: number, y: number, transform: any) => {
    return {
      x: x * transform.scaleX + transform.offsetX,
      y: y * transform.scaleY + transform.offsetY
    };
  };

  const isPointInPolygon = (x: number, y: number, vertices: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i][0], yi = vertices[i][1];
      const xj = vertices[j][0], yj = vertices[j][1];
      const intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointOnCameraZone = (x: number, y: number, vertices: number[][]): boolean => {
    if (!vertices || vertices.length < 4) return false;
    return isPointInPolygon(x, y, vertices);
  };

  const isPointOnCameraIcon = (x: number, y: number, cameraPos: { x: number; y: number }): boolean => {
    const dx = Math.abs(x - cameraPos.x);
    const dy = Math.abs(y - cameraPos.y);
    return dx < 18 && dy < 18;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const transform = getTransform();
    if (!transform) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const svgX = (canvasX - transform.offsetX) / transform.scaleX;
    const svgY = (canvasY - transform.offsetY) / transform.scaleY;
    
    let foundCameraId: number | null = null;
    for (const camera of cameras) {
      if (isPointOnCameraIcon(svgX, svgY, camera.position)) {
        foundCameraId = camera.id;
        break;
      }
    }
    setHoveredCameraId(foundCameraId);
    
    let foundZoneId: number | null = null;
    for (const zone of zones) {
      for (const camera of zone.cameras) {
        if (camera.vertices && camera.vertices.length >= 4) {
          if (isPointOnCameraZone(svgX, svgY, camera.vertices)) {
            foundZoneId = zone.id;
            break;
          }
        }
      }
      if (foundZoneId) break;
    }
    setHoveredZoneId(foundZoneId);
  };

  const drawCameraZones = (ctx: CanvasRenderingContext2D, transform: any) => {
    cameras.forEach(camera => {
      if (camera.vertices && camera.vertices.length >= 4) {
        const points = camera.vertices.map(p => svgToCanvas(p[0], p[1], transform));
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        
        if (isSelectingZone) {
          if (camera.isSelected) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 3;
          } else if (camera.isInZone) {
            ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 2;
          } else {
            ctx.fillStyle = 'rgba(100, 150, 255, 0.15)';
            ctx.strokeStyle = '#6495ED';
            ctx.lineWidth = 2;
          }
        } else {
          ctx.fillStyle = 'rgba(100, 150, 255, 0.15)';
          ctx.strokeStyle = '#6495ED';
          ctx.lineWidth = 2;
        }
        
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  };

  const drawZones = (ctx: CanvasRenderingContext2D, transform: any) => {
    zones.forEach(zone => {
      const shouldBlink = blinkingZones.has(zone.id);
      const isHighlighted = highlightedZoneId === zone.id;
      
      zone.cameras.forEach(camera => {
        if (camera.vertices && camera.vertices.length >= 4) {
          const points = camera.vertices.map(p => svgToCanvas(p[0], p[1], transform));
          
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.closePath();
          
          if (zone.disabled) {
            ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
            ctx.strokeStyle = '#888888';
          } else if (isSelectingZone) {
            return;
          } else {
            const color = zone.type === 'red' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.45)';
            ctx.fillStyle = color;
            ctx.strokeStyle = zone.type === 'red' ? '#EF4444' : '#22C55E';
          }
          
          if (!isSelectingZone) {
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
          }
          
          if (isHighlighted && !isSelectingZone) {
            ctx.save();
            const alpha = highlightIntensity;
            ctx.shadowBlur = 15 * alpha;
            ctx.shadowColor = `rgba(255, 215, 0, ${alpha})`;
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
            ctx.lineWidth = 5 + (1 - alpha) * 3;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();
          }
          
          if (hoveredZoneId === zone.id && !isSelectingZone && !isHighlighted) {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#FFD700';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();
          }
          
          // Мигание при нарушении
          if (shouldBlink && !zone.disabled && zone.type === 'red' && !isSelectingZone) {
            const time = Date.now() / 400;
            const alpha = 0.3 + Math.sin(time) * 0.25;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.fill();
            ctx.restore();
            
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#FF0000';
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();
          }
          
          if (!isSelectingZone) {
            const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
            
            ctx.font = 'bold 28px monospace';
            ctx.fillStyle = zone.disabled ? '#AAAAAA' : (zone.type === 'red' ? '#FF6666' : '#66FF66');
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(zone.id.toString(), centerX, centerY);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          }
        }
      });
    });
  };

  const drawCameras = (ctx: CanvasRenderingContext2D, transform: any) => {
    cameras.forEach(camera => {
      const pos = svgToCanvas(camera.position.x, camera.position.y, transform);
      const isHovered = hoveredCameraId === camera.id;
      
      let color = '#FF4444';
      if (isSelectingZone) {
        color = camera.isSelected ? '#00FFFF' : (camera.isInZone ? '#888888' : '#FF4444');
      } else if (camera.isEditing) {
        color = '#9C27B0';
      } else if (camera.isInZone && !camera.zoneDisabled) {
        color = camera.zoneType === 'red' ? '#EF4444' : '#22C55E';
      }
      
      ctx.save();
      
      if (isHovered && !isSelectingZone) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.translate(pos.x, pos.y);
        ctx.scale(1.2, 1.2);
        ctx.translate(-pos.x, -pos.y);
      } else {
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
      }
      
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.fillRect(pos.x - 14, pos.y - 10, 28, 20);
      ctx.strokeRect(pos.x - 14, pos.y - 10, 28, 20);
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#333333';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(pos.x - 2, pos.y - 2, 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      ctx.fillStyle = color;
      ctx.fillRect(pos.x - 3, pos.y - 18, 6, 8);
      
      if (!camera.isConfigured && !isSelectingZone) {
        ctx.beginPath();
        ctx.arc(pos.x + 12, pos.y - 6, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFAA00';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x + 12, pos.y - 6, 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
      
      ctx.restore();
    });
  };

  const drawDetections = (ctx: CanvasRenderingContext2D, transform: any) => {
    detections.forEach(detection => {
      const pos = svgToCanvas(detection.x, detection.y, transform);
      
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF0000';
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 68, 68, 0.7)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF4444';
      ctx.fill();
      
      ctx.restore();
    });
  };

  const updateCanvasSize = () => {
    const container = svgContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  };

  const renderOverlay = () => {
    const canvas = canvasRef.current;
    const transform = getTransform();
    
    if (!canvas || !transform) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawCameraZones(ctx, transform);
    drawZones(ctx, transform);
    drawCameras(ctx, transform);
    drawDetections(ctx, transform);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const transform = getTransform();
    if (!transform) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const svgX = (canvasX - transform.offsetX) / transform.scaleX;
    const svgY = (canvasY - transform.offsetY) / transform.scaleY;
    
    if (isSelectingZone && onSelectableClick) {
      for (const camera of cameras) {
        if (camera.vertices && camera.vertices.length >= 4) {
          if (isPointOnCameraZone(svgX, svgY, camera.vertices)) {
            onSelectableClick(camera.id);
            return;
          }
        }
      }
      return;
    }
    
    for (const zone of zones) {
      for (const camera of zone.cameras) {
        if (camera.vertices && camera.vertices.length >= 4) {
          if (isPointOnCameraZone(svgX, svgY, camera.vertices)) {
            if (onZoneClick) {
              onZoneClick(zone.id);
            }
            return;
          }
        }
      }
    }
    
    for (const camera of cameras) {
      if (isPointOnCameraIcon(svgX, svgY, camera.position)) {
        if (onCameraClick) {
          onCameraClick(camera.id);
        }
        return;
      }
    }
  };
  
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;
    
    const updateAndRender = () => {
      updateCanvasSize();
      renderOverlay();
    };
    
    const resizeObserver = new ResizeObserver(() => updateAndRender());
    resizeObserver.observe(container);
    
    const svg = container.querySelector('svg');
    if (svg) {
      resizeObserver.observe(svg);
    }
    
    container.addEventListener('scroll', updateAndRender);
    window.addEventListener('resize', updateAndRender);
    
    updateAndRender();
    
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', updateAndRender);
      window.removeEventListener('resize', updateAndRender);
    };
  }, [svgContainerRef.current]);
  
  useEffect(() => {
    const animate = () => {
      renderOverlay();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameras, zones, detections, blinkingZones, isSelectingZone, hoveredZoneId, hoveredCameraId, highlightedZoneId, highlightIntensity]);
  
  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredZoneId(null);
        setHoveredCameraId(null);
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        cursor: isSelectingZone ? 'crosshair' : 'pointer'
      }}
    />
  );
};

export default FloorOverlay;