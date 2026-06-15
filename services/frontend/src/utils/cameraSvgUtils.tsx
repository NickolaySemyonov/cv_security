// frontend/src/utils/cameraSvgUtils.ts

interface Camera {
  id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
}

export function getSvgWithCameras(svgContent: string, cameras: Camera[]): string {
  if (!svgContent) return '';
  
  let modifiedSvg = svgContent;
  
  cameras.forEach((camera) => {
    // Рисуем зону видимости
    if (camera.visible_zone?.vertices && camera.visible_zone.vertices.length >= 4) {
      const points = camera.visible_zone.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
      const polygon = `<polygon points="${points}" fill="rgba(100,150,255,0.15)" stroke="#6495ED" stroke-width="2" stroke-dasharray="4,4" />`;
      modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
    }
    
    // Рисуем иконку камеры
    if (camera.position) {
      const x = camera.position.x;
      const y = camera.position.y;
      const cameraIcon = `
        <g transform="translate(${x - 10}, ${y - 10})">
          <circle cx="10" cy="10" r="10" fill="#FF4444" stroke="#fff" stroke-width="2" />
          <circle cx="10" cy="10" r="5" fill="#fff" />
          <circle cx="10" cy="10" r="2" fill="#FF4444" />
        </g>
      `;
      modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
    }
  });
  
  return modifiedSvg;
}