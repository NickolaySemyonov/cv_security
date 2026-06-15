import { RefObject, KeyboardEvent, useState, useEffect } from 'react';
import { Point, SavedCalibration } from './types';

interface CalibrationPanelProps {
  hasCameras: boolean;
  camerasCount: number;
  isCalibrated: boolean;
  calibrationPoints: Point[];
  calibrationDistance: number | null;
  isSelectingPoints: boolean;
  savedCalibration: SavedCalibration | null;
  isSubmitting: boolean;
  svgContainerRef: RefObject<HTMLDivElement>;
  onStartSelection: () => void;
  onCancelSelection: () => void;
  onResetCalibration: () => void;
  onDistanceChange: (value: number) => void;
  onSaveCalibration: () => void;
  onResetForm: () => void;
  onSvgClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  getSvgWithPoints: () => string;
}

export const CalibrationPanel = ({
  hasCameras,
  camerasCount,
  isCalibrated,
  calibrationPoints,
  calibrationDistance,
  isSelectingPoints,
  isSubmitting,
  onStartSelection,
  onCancelSelection,
  onResetCalibration,
  onDistanceChange,
  onSaveCalibration,
  onResetForm,
  svgContainerRef,
  onSvgClick,
  onMouseMove,
  onMouseLeave,
  getSvgWithPoints
}: CalibrationPanelProps) => {
  
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    if (calibrationDistance === null || calibrationDistance === 0) {
      setInputValue('');
    } else if (calibrationDistance > 0) {
      setInputValue(calibrationDistance.toString());
    }
  }, [calibrationDistance]);

  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    if (value === '') {
      setInputValue('');
      onDistanceChange(0);
      return;
    }
    
    const onlyDigitsPattern = /^\d+$/;
    
    if (!onlyDigitsPattern.test(value)) {
      return;
    }
    
    let numValue = parseInt(value, 10);
    
    if (isNaN(numValue)) {
      return;
    }
    
    if (numValue > 9) {
      setInputValue('9');
      onDistanceChange(9);
      return;
    }
    
    if (numValue === 0) {
      setInputValue('');
      onDistanceChange(0);
      return;
    }
    
    setInputValue(value);
    onDistanceChange(numValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    
    if (key === '0') {
      e.preventDefault();
      return;
    }
    
    const allowedKeys = [
      '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ];
    
    if (!allowedKeys.includes(key)) {
      e.preventDefault();
      return;
    }
  };

  const handleResetClick = async () => {
    const message = hasCameras 
      ? `⚠️ ВНИМАНИЕ!\n\nНа этаже есть ${camerasCount} камер.\n\nПри сбросе калибровки ВСЕ КАМЕРЫ БУДУТ УДАЛЕНЫ.\n\nПродолжить?`
      : 'Вы действительно хотите сбросить калибровку?';
    
    if (window.confirm(message)) {
      await onResetCalibration();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">📏 Шаг 2: Калибровка расстояния</h3>
      <p className="text-gray-600 mb-4">Отметьте на карте две точки с известным расстоянием между ними.</p>
      
      {hasCameras && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          ℹ️ На этаже {camerasCount} камер. При сбросе калибровки все камеры будут удалены.
        </div>
      )}
      
      <div className="bg-yellow-50 rounded-lg p-3 mb-4">
        💡 Выберите объект с известной длиной: дверь (1м), ширина коридора (2м), длина стены (5м)
      </div>

      <div className="border rounded-lg p-2 bg-gray-50 overflow-auto max-h-96 mb-4">
        <div 
          ref={svgContainerRef} 
          className={isSelectingPoints ? 'cursor-crosshair' : ''} 
          onClick={onSvgClick} 
          onMouseMove={onMouseMove} 
          onMouseLeave={onMouseLeave}
        >
          <div dangerouslySetInnerHTML={{ __html: getSvgWithPoints() }} className="inline-block" />
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex gap-2 mb-4">
          {!isSelectingPoints && calibrationPoints.length < 2 && (
            <button onClick={onStartSelection} className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
              🖱️ Выбрать точки
            </button>
          )}
          {(calibrationPoints.length > 0 || isSelectingPoints) && (
            <button onClick={onCancelSelection} className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600">
              🗑️ Отменить выбор
            </button>
          )}
          {isCalibrated && (
            <button 
              onClick={handleResetClick}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition-colors"
            >
              ❌ Сбросить калибровку
            </button>
          )}
        </div>
        
        {calibrationPoints.length === 2 && (calibrationDistance === null || calibrationDistance === 0) && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Реальное расстояние между точками (метры)
            </label>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="\d*"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Введите число от 1 до 9 (например: 1, 2, 5)" 
              value={inputValue}
              onChange={handleDistanceChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <div className="mt-2 flex items-center gap-2 text-xs bg-blue-50 p-2 rounded-lg">
              <span className="text-blue-600">ℹ️</span>
              <span className="text-gray-700">
                Вводите только <strong className="text-blue-600">целые числа от 1 до 9</strong> (1, 2, 3, 4, 5, 6, 7, 8, 9)
              </span>
            </div>
          </div>
        )}
        
        {calibrationDistance !== null && calibrationPoints.length === 2 && calibrationDistance > 0 && (
          <div className="p-3 bg-green-50 rounded-lg">
            ✓ Калибровка готова! Расстояние: {calibrationDistance} м
          </div>
        )}
      </div>

      {calibrationDistance !== null && calibrationPoints.length === 2 && calibrationDistance > 0 && (
        <button 
          onClick={onSaveCalibration} 
          disabled={isSubmitting} 
          className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Сохранение...' : (isCalibrated ? '🔄 Обновить калибровку' : '💾 Сохранить калибровку')}
        </button>
      )}

      <button 
        onClick={onResetForm} 
        className="w-full mt-4 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
      >
        🔄 Очистить форму
      </button>
    </div>
  );
};