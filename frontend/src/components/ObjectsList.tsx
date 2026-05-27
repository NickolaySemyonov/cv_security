import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import SvgPreview from './SvgPreview';
import ObjectForm from './ObjectForm';
import FileInput from './FileInput';
import ObjectCard from './ObjectCard';
import Header from './Header';
import Footer from './Footer';

interface User {
  id: number;
  login: string;
  role: string;
}

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface UniqueObject {
  place: string;
  floorsCount: number;
  floors?: Floor[];
}

interface SelectedFile {
  name: string;
  content: string;
}

interface ObjectsListProps {
  user: User | null;
  onLogout: () => void;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

const ObjectsList = ({ user, onLogout }: ObjectsListProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [floors, setFloors] = useState<Floor[]>([]);
  const [uniqueObjects, setUniqueObjects] = useState<UniqueObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [showFloorForm, setShowFloorForm] = useState<{ show: boolean; place: string }>({ show: false, place: '' });
  const [newObjectName, setNewObjectName] = useState<string>('');
  const [newFloorNumber, setNewFloorNumber] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchFloors();
  }, []);

  const fetchFloors = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await api.get<Floor[]>('/floors');
      setFloors(response.data);
      
      const unique: UniqueObject[] = [];
      const placeSet = new Set<string>();
      
      response.data.forEach((floor: Floor) => {
        if (!placeSet.has(floor.place)) {
          placeSet.add(floor.place);
          unique.push({
            place: floor.place,
            floorsCount: response.data.filter((f: Floor) => f.place === floor.place).length,
            floors: response.data.filter((f: Floor) => f.place === floor.place).sort((a, b) => a.number - b.number)
          });
        }
      });
      
      setUniqueObjects(unique);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError('Не удалось загрузить список объектов');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>): void => {
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

  const resetForm = () => {
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddObject = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newObjectName.trim()) {
      setError('Введите название объекта');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const svgMap = selectedFile?.content || '<svg width="800" height="600" viewBox="0 0 800 600" style="background-color: #f0f0f0"></svg>';
      
      await api.post<Floor>('/floors', {
        number: 1,
        place: newObjectName.trim(),
        map: svgMap
      });
      
      await fetchFloors();
      setShowAddForm(false);
      setNewObjectName('');
      resetForm();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.detail || 'Ошибка при добавлении объекта');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFloor = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newFloorNumber || newFloorNumber < 0) {
      setError('Введите корректный номер этажа');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const svgMap = selectedFile?.content || '<svg width="800" height="600" viewBox="0 0 800 600" style="background-color: #f0f0f0"></svg>';
      
      const existingFloor = floors.find(
        f => f.place === showFloorForm.place && f.number === newFloorNumber
      );
      
      if (existingFloor) {
        setError(`Этаж ${newFloorNumber} у объекта "${showFloorForm.place}" уже существует`);
        setIsSubmitting(false);
        return;
      }
      
      await api.post<Floor>('/floors', {
        number: newFloorNumber,
        place: showFloorForm.place,
        map: svgMap
      });
      
      await fetchFloors();
      setShowFloorForm({ show: false, place: '' });
      setNewFloorNumber(1);
      resetForm();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.detail || 'Ошибка при добавлении этажа');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteObject = async (place: string): Promise<void> => {
    try {
      const floorsToDelete = floors.filter(f => f.place === place);
      
      for (const floor of floorsToDelete) {
        await api.delete(`/floors/${floor.id}`);
      }
      
      await fetchFloors();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.detail || 'Ошибка при удалении объекта');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteFloor = async (floorId: number, place: string): Promise<void> => {
    try {
      await api.delete(`/floors/${floorId}`);
      await fetchFloors();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.detail || 'Ошибка при удалении этажа');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleObjectClick = (place: string): void => {
    navigate(`/objects/${encodeURIComponent(place)}/floors`);
  };

  const openAddFloorForm = (place: string, currentFloorsCount: number): void => {
    setShowFloorForm({ show: true, place });
    setNewFloorNumber(currentFloorsCount + 1);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl text-gray-600">Загрузка объектов...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex justify-center mb-8">
            {isAdmin && (
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  resetForm();
                }}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Добавить объект
              </button>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              {showAddForm && isAdmin && (
                <ObjectForm
                  title="Новый объект"
                  onSubmit={handleAddObject}
                  onCancel={() => setShowAddForm(false)}
                  isSubmitting={isSubmitting}
                  error={error}
                >
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Название объекта</label>
                    <input
                      type="text"
                      value={newObjectName}
                      onChange={(e) => setNewObjectName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      placeholder="Например: Главный корпус"
                      required
                    />
                    <p className="text-gray-400 text-sm mt-1">Будет создан первый этаж</p>
                  </div>
                  
                  <FileInput
                    fileInputRef={fileInputRef}
                    onFileSelect={handleFileSelect}
                    label="Карта этажа (SVG)"
                  />

                  <SvgPreview file={selectedFile} maxHeight="250px" />
                </ObjectForm>
              )}

              {showFloorForm.show && isAdmin && (
                <ObjectForm
                  title={`Добавить этаж к "${showFloorForm.place}"`}
                  onSubmit={handleAddFloor}
                  onCancel={() => setShowFloorForm({ show: false, place: '' })}
                  isSubmitting={isSubmitting}
                  error={error}
                >
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Номер этажа</label>
                    <input
                      type="number"
                      value={newFloorNumber}
                      onChange={(e) => setNewFloorNumber(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      min="1"
                      required
                    />
                  </div>
                  
                  <FileInput
                    fileInputRef={fileInputRef}
                    onFileSelect={handleFileSelect}
                    label="Карта этажа (SVG)"
                    helperText="Оставьте пустым для карты по умолчанию"
                  />

                  <SvgPreview file={selectedFile} maxHeight="250px" />
                </ObjectForm>
              )}
            </div>
          </div>

          {uniqueObjects.length === 0 && !showAddForm ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto mt-8">
              <div className="text-6xl mb-4">🏢</div>
              <h3 className="text-xl font-medium text-gray-700">Нет добавленных объектов</h3>
              <p className="text-gray-400 mt-2">Нажмите "Добавить объект", чтобы начать</p>
            </div>
          ) : (
            <div className="flex justify-center mt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {uniqueObjects.map((obj) => (
                  <ObjectCard
                    key={obj.place}
                    place={obj.place}
                    floorsCount={obj.floorsCount}
                    floors={obj.floors}
                    onCardClick={handleObjectClick}
                    onAddFloor={openAddFloorForm}
                    onDeleteObject={handleDeleteObject}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ObjectsList;