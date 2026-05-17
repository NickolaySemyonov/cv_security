import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';
import FileInput from './FileInput';
import SvgPreview from './SvgPreview';

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

interface SelectedFile {
  name: string;
  content: string;
}

const FloorSetup = ({ user, onLogout, onComplete }: FloorSetupProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Состояния для загрузки карты
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  
  // Состояния калибровки
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationDistance, setCalibrationDistance] = useState<number | null>(null);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [savedCalibration, setSavedCalibration] = useState<{ points: Point[]; distance: number } | null>(null);
  
  // Состояния для камер
  const [hasCameras, setHasCameras] = useState(false);
  const [camerasCount, setCamerasCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepNames = [
    'Загрузка карты',
    'Калибровка расстояния'
  ];

  useEffect(() => {
    if (id) {
      fetchFloor();
      loadSavedCalibration();
      fetchCamerasCount();
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

  const fetchCamerasCount = async () => {
    try {
      const response = await api.get(`/cameras/floor/${id}`);
      const count = response.data.length;
      setCamerasCount(count);
      setHasCameras(count > 0);
    } catch (error) {
      console.error('Ошибка загрузки камер:', error);
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

  // Загрузка новой карты
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.svg')) {
      setError('Пожалуйста, выберите SVG файл');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const svgContent = e.target?.result as string;
      setSelectedFile({
        name: file.name,
        content: svgContent
      });
      setError('');
    };
    reader.onerror = () => {
      setError('Ошибка при чтении файла');
    };
    reader.readAsText(file);
  };

  // Сохранение карты на сервер (с удалением камер)
  const saveMap = async () => {
    if (!selectedFile) return;
    
    // Предупреждение о камерах
    if (hasCameras) {
      const confirm = window.confirm(
        `⚠️ ВНИМАНИЕ!\n\nНа этаже есть ${camerasCount} камер.\n\nПри замене карты ВСЕ КАМЕРЫ БУДУТ УДАЛЕНЫ, так как их координаты станут недействительными.\n\nКалибровка также будет сброшена.\n\nПродолжить?`
      );
      if (!confirm) return;
    }
    
    setIsUploadingMap(true);
    try {
      // Сначала удаляем все камеры этажа
      if (hasCameras) {
        const camerasResponse = await api.get(`/cameras/floor/${id}`);
        for (const camera of camerasResponse.data) {
          await api.delete(`/cameras/${camera.id}`);
        }
      }
      
      // Обновляем карту
      await api.patch(`/floors/${id}`, {
        map: selectedFile.content
      });
      
      // Сбрасываем калибровку
      await api.delete(`/floors/${id}/calibrate`);
      
      await fetchFloor();
      await fetchCamerasCount();
      await loadSavedCalibration();
      
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      alert('Карта успешно загружена! Камеры и калибровка сброшены.');
      
    } catch (error) {
      console.error('Ошибка сохранения карты:', error);
      alert('Ошибка при сохранении карты');
    } finally {
      setIsUploadingMap(false);
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

  // Обновление калибровки (PATCH)
  const updateCalibration = async () => {
    if (!calibrationDistance || calibrationPoints.length !== 2) return;
    
    setIsSubmitting(true);
    
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
      
      // Очищаем форму после сохранения
      setCalibrationPoints([]);
      setCalibrationDistance(null);
      
      alert('Калибровка успешно сохранена!');
      await fetchFloor();
      await fetchCamerasCount();
      
    } catch (error: any) {
      console.error('Ошибка сохранения калибровки:', error);
      alert(error.response?.data?.detail || 'Ошибка при сохранении калибровки');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Сброс калибровки (DELETE) - только если нет камер
  const resetCalibration = async () => {
    if (hasCameras) {
      alert(`❌ Нельзя сбросить калибровку!\n\nНа этаже есть ${camerasCount} камер.\n\nСначала удалите все камеры или обновите калибровку.`);
      return;
    }
    
    if (!window.confirm('Вы действительно хотите сбросить калибровку? Все данные калибровки будут удалены.')) {
      return;
    }
    
    try {
      await api.delete(`/floors/${id}/calibrate`);
      setIsCalibrated(false);
      setSavedCalibration(null);
      setCalibrationPoints([]);
      setCalibrationDistance(null);
      setIsSelectingPoints(false);
      
      alert('Калибровка сброшена');
      await fetchFloor();
      await fetchCamerasCount();
      
    } catch (error: any) {
      console.error('Ошибка сброса:', error);
      alert(error.response?.data?.detail || 'Ошибка при сбросе калибровки');
    }
  };

  // Отмена текущей калибровки (сброс выбранных точек)
  const cancelCurrentCalibration = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(false);
  };

  // Сброс только второго шага (очистка формы)
  const resetSecondStep = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(false);
  };

  // Завершение - переход на страницу этажа
  const handleComplete = () => {
    if (floor?.place && floor?.number) {
      navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
    } else {
      navigate('/objects');
    }
    onComplete?.();
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // На первом шаге - выход на страницу этажа
      if (floor?.place && floor?.number) {
        navigate(`/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`);
      } else {
        navigate('/objects');
      }
    } else {
      setCurrentStep(0);
    }
  };

  const handleNextStep = () => {
    // Проверяем, есть ли карта перед переходом на второй шаг
    if (currentStep === 0) {
      if (!hasMap) {
        alert('Сначала загрузите карту этажа!');
        return;
      }
      setCurrentStep(1);
    }
  };

  const startPointSelection = () => {
    setCalibrationPoints([]);
    setCalibrationDistance(null);
    setIsSelectingPoints(true);
  };

  const progress = ((currentStep + 1) / stepNames.length) * 100;

  // Проверка, есть ли реальная карта (не пустая)
  const hasMap = floor?.map && floor.map.length > 100 && !floor.map.includes('background-color: #f0f0f0');

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
                className={`text-center p-2 rounded-lg text-xs cursor-pointer transition-all
                  ${index === currentStep 
                    ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' 
                    : index < currentStep
                      ? 'bg-green-50 text-green-600'
                      : hasMap && index === 1
                        ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                onClick={() => {
                  if (index === 0) {
                    setCurrentStep(0);
                  } else if (index === 1 && hasMap) {
                    setCurrentStep(1);
                  } else if (index === 1 && !hasMap) {
                    alert('Сначала загрузите карту этажа');
                  }
                }}
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

        {/* Шаг 1: Загрузка карты */}
        {currentStep === 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📁 Шаг 1: Загрузка карты</h3>
            
            <p className="text-gray-600 mb-4">
              Загрузите SVG карту этажа. Карта обязательна для продолжения.
            </p>
            
            {hasCameras && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  ⚠️ На этаже есть {camerasCount} камер. При замене карты все камеры будут удалены.
                </p>
              </div>
            )}
            
            {!hasMap ? (
              <>
                <FileInput
                  fileInputRef={fileInputRef}
                  onFileSelect={handleFileSelect}
                  label="Выберите SVG файл"
                  helperText="Поддерживаются только SVG файлы"
                />

                <SvgPreview file={selectedFile} maxHeight="300px" />

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={saveMap}
                    disabled={!selectedFile || isUploadingMap}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
                  >
                    {isUploadingMap ? 'Загрузка...' : '💾 Сохранить карту'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    ✓ Карта загружена
                  </p>
                </div>
                
                <div className="border rounded-lg p-2 bg-gray-50 overflow-auto max-h-96">
                  <div
                    dangerouslySetInnerHTML={{ __html: floor.map || '' }}
                    className="inline-block"
                  />
                </div>
                
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Далее → Калибровка
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    🔄 Заменить карту
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Шаг 2: Калибровка */}
        {currentStep === 1 && hasMap && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📏 Шаг 2: Калибровка расстояния</h3>
            
            <p className="text-gray-600 mb-4">
              Отметьте на карте две точки с известным расстоянием между ними.
            </p>
            
            {/* Информация о камерах */}
            {hasCameras && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  ℹ️ На этаже {camerasCount} {camerasCount === 1 ? 'камера' : 'камер'}. 
                  Калибровку нельзя сбросить, но можно обновить.
                </p>
              </div>
            )}
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                💡 Совет: Выберите объект с известной длиной:<br />
                • Дверной проём — 0.9 метра<br />
                • Ширина коридора — 2 метра<br />
                • Длина стены — 5 метров
              </p>
            </div>

            <div className="border rounded-lg p-2 bg-gray-50 overflow-auto max-h-96 mb-4">
              <div 
                ref={svgContainerRef}
                className={`${isSelectingPoints ? 'cursor-crosshair' : ''}`}
                onClick={handleSvgClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverPoint(null)}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: getSvgWithPoints(floor.map || '') }}
                  className="inline-block"
                />
              </div>
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
                
                {/* Кнопка сброса - отключаем если есть камеры */}
                {isCalibrated && (
                  <button
                    onClick={resetCalibration}
                    disabled={hasCameras}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                      hasCameras 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600'
                    } text-white`}
                    title={hasCameras ? `Нельзя сбросить: на этаже ${camerasCount} камер` : 'Сбросить калибровку'}
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

            {/* Кнопка сохранения калибровки */}
            {calibrationDistance && calibrationPoints.length === 2 && (
              <button
                onClick={updateCalibration}
                disabled={isSubmitting}
                className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Сохранение...' : (isCalibrated ? '🔄 Обновить калибровку' : '💾 Сохранить калибровку')}
              </button>
            )}

            <div className="flex gap-2 mt-4">
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
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {currentStep === 0 ? 'Отмена' : 'Назад'}
            </button>
          </div>
          
          <div className="flex gap-3">
            {/* Кнопка "Далее" на первом шаге - только если есть карта */}
            {currentStep === 0 && hasMap && (
              <button
                onClick={handleNextStep}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                Далее →
              </button>
            )}
            
            {/* Кнопка "Завершить" на втором шаге */}
            {currentStep === 1 && (
              <button
                onClick={handleComplete}
                disabled={!isCalibrated}
                className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isCalibrated 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-300 cursor-not-allowed text-gray-500'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {hasCameras ? 'Завершить' : 'Завершить калибровку'}
              </button>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FloorSetup;