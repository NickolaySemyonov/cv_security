import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/axios';
import Header from '../Header';
import Footer from '../Footer';
import { ProgressBar } from './ProgressBar';
import { MapUploader } from './MapUploader';
import { CalibrationPanel } from './CalibrationPanel';
import { hasRealMap, getSvgWithPoints, getSvgCoordinates } from './utils';
import { Floor, User, FloorSetupProps, Point, SelectedFile, SavedCalibration } from './types';

const FloorSetup = ({ user, onLogout, onComplete }: FloorSetupProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const svgContainerRef = useRef<HTMLDivElement>(null);
  
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationDistance, setCalibrationDistance] = useState<number | null>(null);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [savedCalibration, setSavedCalibration] = useState<SavedCalibration | null>(null);
  const [hasCameras, setHasCameras] = useState(false);
  const [camerasCount, setCamerasCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepNames = ['Загрузка карты', 'Калибровка расстояния'];
  
  const hasMap = !!floor?.map && 
                 floor.map.length > 0 && 
                 !floor.map.includes('background-color: #f0f0f0') &&
                 floor.map.includes('<svg');

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

  useEffect(() => {
    if (hasMap && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [hasMap, currentStep]);

  const fetchFloor = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/floors/${id}`);
      setFloor(response.data);
      setIsCalibrated(!!response.data.is_calibrated);
    } catch (error) {
      setError('Не удалось загрузить данные этажа');
    } finally {
      setLoading(false);
    }
  };

  const fetchCamerasCount = async () => {
    try {
      const response = await api.get(`/cameras/floor/${id}`);
      setCamerasCount(response.data.length);
      setHasCameras(response.data.length > 0);
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

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.svg')) {
      setError('Пожалуйста, выберите SVG файл');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSelectedFile({ name: file.name, content: e.target?.result as string });
    reader.readAsText(file);
  };

  const saveMap = async () => {
    if (!selectedFile) return;
    if (hasCameras && !window.confirm(`⚠️ На этаже ${camerasCount} камер. При замене карты ВСЕ КАМЕРЫ БУДУТ УДАЛЕНЫ. Продолжить?`)) return;
    
    setIsUploadingMap(true);
    try {
      const response = await api.patch(`/floors/${id}`, { map: selectedFile.content });
      await api.delete(`/floors/${id}/calibrate`);
      await fetchFloor();
      await fetchCamerasCount();
      await loadSavedCalibration();
      setSelectedFile(null);
      alert(response.data.cameras_deleted ? `Карта загружена! Удалено ${response.data.cameras_deleted} камер` : 'Карта успешно загружена!');
    } catch (error) {
      alert('Ошибка при сохранении карты');
    } finally {
      setIsUploadingMap(false);
    }
  };

  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingPoints) return;
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return;
    const coords = getSvgCoordinates(event, svgElement);
    if (coords && calibrationPoints.length < 2) {
      const newPoints = [...calibrationPoints, coords];
      setCalibrationPoints(newPoints);
      if (newPoints.length === 2) setIsSelectingPoints(false);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingPoints) { 
      setHoverPoint(null); 
      return; 
    }
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return;
    const coords = getSvgCoordinates(event, svgElement);
    if (coords) setHoverPoint(coords);
  };

  // Сохранение калибровки
  const updateCalibration = async () => {
    if (!calibrationDistance || calibrationPoints.length !== 2) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/floors/${id}/calibrate`, {
        calibration_points: calibrationPoints,
        calibration_distance: calibrationDistance,
        is_calibrated: true
      });
      
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      alert('Калибровка успешно сохранена!');
      
      // Переход на страницу этажа
      if (floor?.place && floor?.number) {
        window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`;
      } else if (floor?.place) {
        window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors`;
      } else {
        window.location.href = '/objects';
      }
      onComplete?.();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Ошибка при сохранении калибровки');
      setIsSubmitting(false);
    }
  };

  // Сброс калибровки с автоматическим переходом на страницу этажа
  const resetCalibration = async () => {
    try {
      const response = await api.delete(`/floors/${id}/calibrate`);
      
      sessionStorage.setItem('camerasUpdated', Date.now().toString());
      
      const deletedCount = response.data.cameras_deleted || 0;
      alert(`Калибровка сброшена. Удалено ${deletedCount} камер.`);
      
      // Автоматический переход на страницу этажа
      if (floor?.place && floor?.number) {
        window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`;
      } else if (floor?.place) {
        window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors`;
      } else {
        window.location.href = '/objects';
      }
      onComplete?.();
    } catch (error: any) {
      console.error('Ошибка сброса калибровки:', error);
      alert(error.response?.data?.detail || 'Ошибка при сбросе калибровки');
    }
  };

  // Функция отмены
  const handleCancel = () => {
    if (floor?.place && floor?.number) {
      window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors?floor=${floor.number}`;
    } else if (floor?.place) {
      window.location.href = `/objects/${encodeURIComponent(floor.place)}/floors`;
    } else {
      window.location.href = '/objects';
    }
    onComplete?.();
  };

  const handleNextStep = () => {
    if (hasMap) {
      setCurrentStep(1);
    } else {
      alert('Сначала загрузите карту этажа!');
    }
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
            <button onClick={handleCancel} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
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
        <ProgressBar 
          currentStep={currentStep} 
          totalSteps={stepNames.length} 
          stepNames={stepNames} 
          hasMap={hasMap} 
          onStepClick={(step) => {
            if (step === 0) {
              setCurrentStep(0);
            } else if (step === 1 && hasMap) {
              setCurrentStep(1);
            } else if (step === 1 && !hasMap) {
              alert('Сначала загрузите карту этажа');
            }
          }}
        />
        
        {currentStep === 0 && (
          <MapUploader
            hasMap={hasMap}
            hasCameras={hasCameras}
            camerasCount={camerasCount}
            selectedFile={selectedFile}
            isUploadingMap={isUploadingMap}
            onFileSelect={handleFileSelect}
            onSave={saveMap}
            floorMap={floor.map}
          />
        )}
        
        {currentStep === 1 && hasMap && (
          <CalibrationPanel
            hasCameras={hasCameras}
            camerasCount={camerasCount}
            isCalibrated={isCalibrated}
            calibrationPoints={calibrationPoints}
            calibrationDistance={calibrationDistance}
            isSelectingPoints={isSelectingPoints}
            savedCalibration={savedCalibration}
            isSubmitting={isSubmitting}
            svgContainerRef={svgContainerRef}
            onStartSelection={() => { 
              setCalibrationPoints([]); 
              setCalibrationDistance(null); 
              setIsSelectingPoints(true); 
            }}
            onCancelSelection={() => { 
              setCalibrationPoints([]); 
              setCalibrationDistance(null); 
              setIsSelectingPoints(false); 
            }}
            onResetCalibration={resetCalibration}
            onDistanceChange={(v) => setCalibrationDistance(v)}
            onSaveCalibration={updateCalibration}
            onResetForm={() => { 
              setCalibrationPoints([]); 
              setCalibrationDistance(null); 
              setIsSelectingPoints(false); 
            }}
            onSvgClick={handleSvgClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverPoint(null)}
            getSvgWithPoints={() => getSvgWithPoints(
              floor.map, 
              savedCalibration, 
              calibrationPoints, 
              isSelectingPoints, 
              hoverPoint
            )}
          />
        )}
        
        <div className="flex justify-between mt-6">
          <button 
            onClick={handleCancel} 
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Отмена
          </button>
          
          {currentStep === 0 && hasMap && (
            <button onClick={handleNextStep} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
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