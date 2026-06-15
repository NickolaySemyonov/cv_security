import { useRef } from 'react';
import FileInput from '../FileInput';
import SvgPreview from '../SvgPreview';

interface MapUploaderProps {
  hasMap: boolean;
  hasCameras: boolean;
  camerasCount: number;
  selectedFile: { name: string; content: string } | null;
  isUploadingMap: boolean;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  floorMap?: string;
}

export const MapUploader = ({
  hasMap,
  hasCameras,
  camerasCount,
  selectedFile,
  isUploadingMap,
  onFileSelect,
  onSave,
  floorMap
}: MapUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">📁 Шаг 1: Загрузка карты</h3>
      <p className="text-gray-600 mb-4">Загрузите SVG карту этажа. Карта обязательна для продолжения.</p>
      
      {hasCameras && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            ⚠️ На этаже есть {camerasCount} камер. При замене карты все камеры будут удалены.
          </p>
        </div>
      )}
      
      {!hasMap ? (
        <>
          <FileInput fileInputRef={fileInputRef} onFileSelect={onFileSelect} label="Выберите SVG файл" helperText="Поддерживаются только SVG файлы" />
          <SvgPreview file={selectedFile} maxHeight="300px" />
          <button onClick={onSave} disabled={!selectedFile || isUploadingMap} className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50">
            {isUploadingMap ? 'Загрузка...' : '💾 Сохранить карту'}
          </button>
        </>
      ) : (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">✓ Карта загружена</div>
          <div className="border rounded-lg p-2 bg-gray-50 overflow-auto max-h-96">
            <div dangerouslySetInnerHTML={{ __html: floorMap || '' }} className="inline-block" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleReplaceClick} className="...">
            🔄 Заменить карту
            </button>
            <FileInput fileInputRef={fileInputRef} onFileSelect={onFileSelect} label="" hidden />
          </div>
        </>
      )}
    </div>
  );
};