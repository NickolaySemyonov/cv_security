// frontend/src/components/FloorSetup.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
  is_calibrated?: boolean;
}

interface User {
  id: number;
  login: string;
}

interface FloorSetupProps {
  user: User | null;
  onLogout: () => void;
  onComplete?: () => void;
}

interface Point {
  x: number;
  y: number;
}

const FloorSetup = ({ user, onLogout, onComplete }: FloorSetupProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const svgContainerRef = useRef<HTMLDivElement>(null);
  
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Состояния калибровки
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationDistance, setCalibrationDistance] = useState<number | null>(null);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [savedCalibration, setSavedCalibration] = useState<{ points: Point[]; distance: number } | null>(null);

  const stepNames = [
    'Загрузка карты',
    'Калибровка расстояния'
  ];

  useEffect(() => {
    if (id) {
      fetchFloor();
      loadSavedCalibration();
    } else {
      setError('ID этажа не указан');
      setLoading(false);
    }
  }, [id]);

  const fetchFloor = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/floors/${id}`);
      setFloor(response.data);
      
      if (response.data.is_calibrated) {
        setIsCalibrated(true);
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      setError('Не удалось загрузить данные этажа');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCalibration = async () => {
    try {
      const response = await api.get(`/floors/${id}/settings`);
      if (response.data.calibration_points && response.data.calibration_distance) {
        setSavedCalibration({
          points: response.data.calibration_points,
          distance: response.data.calibration_distance
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки сохранённой калибровки:', error);
    }
  };

  // Обработка клика по SVG для выбора точек
  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingPoints) return;
    
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return;
    
    const rect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox?.baseVal;
    const scaleX = viewBox ? viewBox.width / rect.width : 1;
    const scaleY = viewBox ? viewBox.height / rect.height : 1;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    if (calibrationPoints.length < 2) {
      const newPoints = [...calibrationPoints, { x, y }];
      setCalibrationPoints(newPoints);
      
      if (newPoints.length === 2) {
        setIsSelectingPoints(false);
      }
    }
  };

  // Отслеживание движения мыши для отображения позиции
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingPoints) {
      setHoverPoint(null);
      return;
    }
    
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return;
    
    const rect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox?.baseVal;
    const scaleX = viewBox ? viewBox.width / rect.width : 1;
    const scaleY = viewBox ? viewBox.height / rect.height : 1;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    setHoverPoint({ x, y });
  };

  // Сохранение калибровки
  const saveCalibration = async () => {
    if (!calibrationDistance || calibrationPoints.length !== 2) return;
    
    try {
      await api.patch(`/floors/${id}/calibrate`, {
        calibration_points: calibrationPoints,
        calibration_distance: calibrationDistance,
        is_calibrated: true
      });
      setIsCalibrated(true);
      setSavedCalibration({
        points: calibrationPoints,
        distance: calibrationDistance
      });
    } catch (error) {
      console.error('Ошибка сохранения калибровки:', error);
    }
  };

  // Отмена текущей калибровки (сброс выбранных точек)
  const cancelCurrentCalibration = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(false);
  };

  // Полная отмена калибровки (удаление сохранённой)
  const cancelFullCalibration = async () => {
    try {
      await api.delete(`/floors/${id}/calibrate`);
      setIsCalibrated(false);
      setSavedCalibration(null);
      setCalibrationPoints([]);
      setCalibrationDistance(null);
      setIsSelectingPoints(false);
    } catch (error) {
      console.error('Ошибка отмены калибровки:', error);
    }
  };

  // Сброс только второго шага (очистка формы)
  const resetSecondStep = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(false);
  };

  const handleCompleteSetup = async () => {
    await saveCalibration();
    // Перенаправляем на страницу этажа с конкретным этажом
    if (floor?.place && floor?.number) {
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
    } else {
      navigate('/objects');
    }
    onComplete?.();
  };

  const handleBack = () => {
    // Выход на страницу этажа (текущий этаж)
    if (floor?.place && floor?.number) {
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
    } else {
      navigate('/objects');
    }
  };

  const handleNextStep = () => {
    if (currentStep < stepNames.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 0) {
      // На первом шаге выходим на страницу этажа
      handleBack();
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const startPointSelection = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(true);
  };

  const progress = ((currentStep + 1) / stepNames.length) * 100;

  // Функция для встраивания точек в SVG
  const getSvgWithPoints = (originalSvg: string): string => {
    if (!originalSvg) return '';
    
    const svgEndIndex = originalSvg.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return originalSvg;
    
    let markers = '';
    
    // Сохранённые точки (если есть и не в режиме выбора)
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
    
    // Точки, которые сейчас выбираются
    calibrationPoints.forEach((point, idx) => {
      markers += `
        <circle cx="${point.x}" cy="${point.y}" r="10" fill="#EF4444" stroke="#fff" stroke-width="2" />
        <text x="${point.x + 14}" y="${point.y + 5}" fill="#EF4444" font-size="14" font-weight="bold">${idx === 0 ? 'A' : 'B'}</text>
      `;
    });
    
    // Линия между выбранными точками
    if (calibrationPoints.length === 2) {
      markers += `
        <line x1="${calibrationPoints[0].x}" y1="${calibrationPoints[0].y}" 
              x2="${calibrationPoints[1].x}" y2="${calibrationPoints[1].y}" 
              stroke="#EF4444" stroke-width="3" stroke-dasharray="8,4" />
      `;
    }
    
    // Точка при наведении мыши
    if (isSelectingPoints && hoverPoint && calibrationPoints.length < 2) {
      markers += `
        <circle cx="${hoverPoint.x}" cy="${hoverPoint.y}" r="6" fill="#3B82F6" fill-opacity="0.5" stroke="#3B82F6" stroke-width="2" />
        <text x="${hoverPoint.x + 10}" y="${hoverPoint.y - 5}" fill="#3B82F6" font-size="10">(${Math.round(hoverPoint.x)}, ${Math.round(hoverPoint.y)})</text>
      `;
    }
    
    return originalSvg.slice(0, svgEndIndex) + markers + originalSvg.slice(svgEndIndex);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={user} onLogout={onLogout} title="Калибровка этажа" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-600">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !floor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={user} onLogout={onLogout} title="Ошибка" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-center">
            <div className="text-xl text-red-600 mb-4">{error || 'Этаж не найден'}</div>
            <button
              onClick={handleBack}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              ← Вернуться к этажам
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} title={`Калибровка: ${floor.place} - Этаж ${floor.number}`} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-grow">
        {/* Прогресс-бар */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">
              Калибровка этажа
            </h3>
            <span className="text-sm text-gray-500">
              Шаг {currentStep + 1} из {stepNames.length}
            </span>
          </div>

          <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {stepNames.map((name, index) => (
              <div
                key={index}
                className={`text-center p-2 rounded-lg text-xs
                  ${index === currentStep 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : index < currentStep
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
              >
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-xs
                  ${index === currentStep
                    ? 'bg-blue-500 text-white'
                    : index < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {index < currentStep ? '✓' : index + 1}
                </div>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Карта этажа */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-500">Карта этажа:</p>
            {isSelectingPoints && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                🔴 Выбрано {calibrationPoints.length} из 2 точек
              </span>
            )}
            {savedCalibration && !isSelectingPoints && calibrationPoints.length === 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                ✓ Калибровка сохранена
              </span>
            )}
          </div>
          <div 
            ref={svgContainerRef}
            className={`border rounded-lg p-2 bg-gray-50 overflow-auto max-h-96 ${isSelectingPoints ? 'cursor-crosshair' : ''}`}
            onClick={handleSvgClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverPoint(null)}
          >
            <div
              dangerouslySetInnerHTML={{ __html: getSvgWithPoints(floor.map || '') }}
              className="inline-block"
            />
          </div>
          
          {/* Информация о выбранных точках */}
          {(calibrationPoints.length > 0 || savedCalibration) && (
            <div className="mt-3 p-2 bg-gray-100 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">📍 Отмеченные точки:</p>
              <div className="space-y-1">
                {calibrationPoints.map((point, idx) => (
                  <div key={idx} className="text-xs text-gray-700">
                    Точка {idx === 0 ? 'A' : 'B'}: X={Math.round(point.x)}, Y={Math.round(point.y)}
                  </div>
                ))}
                {savedCalibration && calibrationPoints.length === 0 && (
                  <>
                    <div className="text-xs text-gray-700">
                      Точка A: X={Math.round(savedCalibration.points[0]?.x || 0)}, Y={Math.round(savedCalibration.points[0]?.y || 0)}
                    </div>
                    <div className="text-xs text-gray-700">
                      Точка B: X={Math.round(savedCalibration.points[1]?.x || 0)}, Y={Math.round(savedCalibration.points[1]?.y || 0)}
                    </div>
                    <div className="text-xs text-green-600">
                      Расстояние: {savedCalibration.distance} метров
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Шаг 1: Загрузка карты */}
        {currentStep === 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📁 Шаг 1: Загрузка карты</h3>
            <p className="text-gray-600 mb-4">
              Карта этажа успешно загружена. Переходите к калибровке.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">
                ✓ Карта загружена: {floor.map?.length || 0} символов
              </p>
            </div>
          </div>
        )}

        {/* Шаг 2: Калибровка */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📏 Шаг 2: Калибровка расстояния</h3>
            
            <p className="text-gray-600 mb-4">
              Отметьте на карте две точки с известным расстоянием между ними.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                💡 Совет: Выберите объект с известной длиной:<br />
                • Дверной проём — 0.9 метра<br />
                • Ширина коридора — 2 метра<br />
                • Длина стены — 5 метров
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">Статус калибровки:</span>
                <span className="text-sm text-gray-500">
                  {calibrationPoints.length} / 2 точек выбрано
                </span>
              </div>
              
              <div className="flex gap-2 mb-4">
                {!isSelectingPoints && calibrationPoints.length < 2 && (
                  <button
                    onClick={startPointSelection}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    🖱️ Выбрать точки на карте
                  </button>
                )}
                
                {(calibrationPoints.length > 0 || isSelectingPoints) && (
                  <button
                    onClick={cancelCurrentCalibration}
                    className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    🗑️ Отменить выбор
                  </button>
                )}
                
                {isCalibrated && (
                  <button
                    onClick={cancelFullCalibration}
                    className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    ❌ Сбросить калибровку
                  </button>
                )}
              </div>
              
              {calibrationPoints.length === 2 && !calibrationDistance && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Реальное расстояние между точками (метры)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Например: 5"
                    value={calibrationDistance || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        setCalibrationDistance(value);
                      }
                    }}
                  />
                </div>
              )}
              
              {calibrationDistance && calibrationPoints.length === 2 && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-700 text-sm">
                    ✓ Калибровка готова к сохранению! Расстояние: {calibrationDistance} метров
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Расстояние на карте: {Math.round(
                      Math.sqrt(
                        Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
                        Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
                      )
                    )} пикселей
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={saveCalibration}
                disabled={!calibrationDistance || calibrationPoints.length !== 2}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
              >
                💾 Сохранить калибровку
              </button>
              
              <button
                onClick={resetSecondStep}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                🔄 Очистить форму
              </button>
            </div>
          </div>
        )}

        {/* Кнопки навигации */}
        <div className="flex justify-between mt-6">
          <div className="flex gap-3">
            {/* Кнопка "Назад" - только если не первый шаг */}
            {currentStep === 1 && (
              <button
                onClick={handlePrevStep}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                ← Назад
              </button>
            )}
            
            {/* Кнопка "Отмена" (Выйти) - всегда видна */}
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Отмена
            </button>
          </div>
          
          {currentStep === stepNames.length - 1 ? (
            <button
              onClick={handleCompleteSetup}
              disabled={!isCalibrated}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              ✅ Завершить калибровку
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              disabled={currentStep === 1 && !isCalibrated}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              Далее →
            </button>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FloorSetup;