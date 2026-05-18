import { Point } from './types';

export const hasRealMap = (map: string | undefined): boolean => {
  return !!(map && map.length > 100 && !map.includes('background-color: #f0f0f0'));
};

export const getSvgWithPoints = (
  originalSvg: string,
  savedCalibration: { points: Point[]; distance: number } | null,
  calibrationPoints: Point[],
  isSelectingPoints: boolean,
  hoverPoint: Point | null
): string => {
  if (!originalSvg) return '';
  
  const svgEndIndex = originalSvg.lastIndexOf('</svg>');
  if (svgEndIndex === -1) return originalSvg;
  
  let markers = '';
  
  // Сохранённые точки
  if (savedCalibration && !isSelectingPoints && calibrationPoints.length === 0) {
    savedCalibration.points.forEach((point, idx) => {
      markers += `
        <circle cx="${point.x}" cy="${point.y}" r="8" fill="#10B981" stroke="#fff" stroke-width="2" />
        <text x="${point.x + 12}" y="${point.y + 4}" fill="#10B981" font-size="12" font-weight="bold">${idx === 0 ? 'A' : 'B'}</text>
      `;
    });
    if (savedCalibration.points.length === 2) {
      markers += `
        <line x1="${savedCalibration.points[0].x}" y1="${savedCalibration.points[0].y}" 
              x2="${savedCalibration.points[1].x}" y2="${savedCalibration.points[1].y}" 
              stroke="#10B981" stroke-width="2" stroke-dasharray="5,5" />
      `;
    }
  }
  
  // Выбираемые точки
  calibrationPoints.forEach((point, idx) => {
    markers += `
      <circle cx="${point.x}" cy="${point.y}" r="10" fill="#EF4444" stroke="#fff" stroke-width="2" />
      <text x="${point.x + 14}" y="${point.y + 5}" fill="#EF4444" font-size="14" font-weight="bold">${idx === 0 ? 'A' : 'B'}</text>
    `;
  });
  
  // Линия между точками
  if (calibrationPoints.length === 2) {
    markers += `
      <line x1="${calibrationPoints[0].x}" y1="${calibrationPoints[0].y}" 
            x2="${calibrationPoints[1].x}" y2="${calibrationPoints[1].y}" 
            stroke="#EF4444" stroke-width="3" stroke-dasharray="8,4" />
    `;
  }
  
  // Точка при наведении
  if (isSelectingPoints && hoverPoint && calibrationPoints.length < 2) {
    markers += `
      <circle cx="${hoverPoint.x}" cy="${hoverPoint.y}" r="6" fill="#3B82F6" fill-opacity="0.5" stroke="#3B82F6" stroke-width="2" />
      <text x="${hoverPoint.x + 10}" y="${hoverPoint.y - 5}" fill="#3B82F6" font-size="10">(${Math.round(hoverPoint.x)}, ${Math.round(hoverPoint.y)})</text>
    `;
  }
  
  return originalSvg.slice(0, svgEndIndex) + markers + originalSvg.slice(svgEndIndex);
};

export const getSvgCoordinates = (
  event: React.MouseEvent<HTMLDivElement>,
  svgElement: SVGSVGElement | null
): Point | null => {
  if (!svgElement) return null;
  
  const rect = svgElement.getBoundingClientRect();
  const viewBox = svgElement.viewBox?.baseVal;
  const scaleX = viewBox ? viewBox.width / rect.width : 1;
  const scaleY = viewBox ? viewBox.height / rect.height : 1;
  
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
};