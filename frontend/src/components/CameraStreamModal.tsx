import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface CameraStreamModalProps {
  cameraId: number;
  streamUrl: string;
  floorMap?: string;
  cameraZone?: number[][];
  cameraPosition?: { x: number; y: number };
  onClose: () => void;
}

const CameraStreamModal = ({ 
  cameraId, 
  streamUrl, 
  floorMap, 
  cameraZone, 
  cameraPosition,
  onClose 
}: CameraStreamModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (!streamUrl) {
      setError('URL видеопотока не настроен');
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.src = '';
    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.error('Автовоспроизведение заблокировано:', e));
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Не удалось загрузить видеопоток');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('error', () => {
        setError('Не удалось загрузить видеопоток');
      });
    } else {
      setError('Ваш браузер не поддерживает HLS');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  const getMiniMapWithZone = (): string => {
    if (!floorMap) {
      return '<div style="padding: 20px; text-align: center; color: #666;">Карта этажа недоступна</div>';
    }
    
    let modifiedSvg = floorMap;
    
    const hasViewBox = /viewBox=["'][^"']*["']/.test(modifiedSvg);
    if (!hasViewBox) {
      const widthMatch = modifiedSvg.match(/width=["']([0-9.]+)/);
      const heightMatch = modifiedSvg.match(/height=["']([0-9.]+)/);
      if (widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        modifiedSvg = modifiedSvg.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
      } else {
        modifiedSvg = modifiedSvg.replace(/<svg/i, `<svg viewBox="0 0 800 600"`);
      }
    }
    
    modifiedSvg = modifiedSvg.replace(/<svg/i, '<svg style="width:100%; height:auto; max-height:200px; display:block; margin:0 auto;"');
    
    if (cameraZone && cameraZone.length >= 4) {
      const points = cameraZone.map(p => `${p[0]},${p[1]}`).join(' ');
      const polygon = `<polygon points="${points}" fill="rgba(255, 215, 0, 0.3)" stroke="#FFD700" stroke-width="3" stroke-dasharray="6,4" />`;
      modifiedSvg = modifiedSvg.replace('</svg>', polygon + '</svg>');
    }
    
    if (cameraPosition) {
      const x = cameraPosition.x;
      const y = cameraPosition.y;
      const cameraIcon = `
        <g transform="translate(${x - 12}, ${y - 12})">
          <circle cx="12" cy="12" r="12" fill="#FFD700" stroke="#B8860B" stroke-width="2" />
          <circle cx="12" cy="12" r="6" fill="#FFF8DC" />
          <circle cx="12" cy="12" r="3" fill="#FFD700" />
        </g>
      `;
      modifiedSvg = modifiedSvg.replace('</svg>', cameraIcon + '</svg>');
    }
    
    return modifiedSvg;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-200">Камера #{cameraId}</h3>
          </div>
          <div className="flex items-center gap-2">
            {floorMap && (
              <button
                onClick={() => setShowMap(!showMap)}
                className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                {showMap ? 'Скрыть карту' : 'Показать карту'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {/* Видеопоток */}
          <div className="mb-4">
            {error ? (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-8 text-center">
                <div className="text-red-400 text-lg mb-2">⚠️ {error}</div>
                <p className="text-gray-400 text-sm">URL видеопотока: {streamUrl || 'не указан'}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                controls
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '50vh' }}
              />
            )}
          </div>
          
          {/* Карта этажа с зоной видимости */}
          {showMap && floorMap && !error && (
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400"> Зона видимости камеры на карте этажа:</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 flex justify-center">
                <div
                  dangerouslySetInnerHTML={{ __html: getMiniMapWithZone() }}
                  style={{ maxWidth: '100%', maxHeight: '250px' }}
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-400">Зона видимости камеры</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-400">Позиция камеры</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraStreamModal;