// frontend/src/components/ObjectsList.tsx
import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';

// ========== Интерфейсы ==========
interface User {
  id: number;
  login: string;
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

// ========== Компонент ==========
const ObjectsList = ({ user, onLogout }: ObjectsListProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [floors, setFloors] = useState<Floor[]>([]);
  const [uniqueObjects, setUniqueObjects] = useState<UniqueObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newObjectName, setNewObjectName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
            floorsCount: response.data.filter((f: Floor) => f.place === floor.place).length
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

  // Чтение SVG файла
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Проверяем тип файла
    if (!file.name.endsWith('.svg')) {
      setError('Пожалуйста, выберите SVG файл');
      return;
    }
    
    // Читаем файл
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

  // Создание объекта с SVG картой
  const handleAddObject = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newObjectName.trim()) {
      setError('Введите название объекта');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Используем загруженную карту или карту по умолчанию
      const svgMap = selectedFile?.content || '<svg width="800" height="600" viewBox="0 0 800 600" style="background-color: #f0f0f0"></svg>';
      
      await api.post<Floor>('/floors', {
        number: 1,
        place: newObjectName.trim(),
        map: svgMap
      });
      
      await fetchFloors();
      setShowAddForm(false);
      setNewObjectName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.detail || 'Ошибка при добавлении объекта');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleObjectClick = (place: string): void => {
    console.log(`Нажат объект: ${place}`);
    // TODO: navigate(`/objects/${encodeURIComponent(place)}/floors`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl text-gray-600">Загрузка объектов...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Система мониторинга
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.login?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-gray-700 font-medium">{user?.login}</span>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all duration-200"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setError('');
              setSelectedFile(null);
            }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Добавить объект
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Новый объект
            </h2>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 border border-red-200">
                {error}
              </div>
            )}
            
            <form onSubmit={handleAddObject}>
              <div className="mb-5">
                <label className="block text-gray-700 font-medium mb-2">Название объекта</label>
                <input
                  type="text"
                  value={newObjectName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewObjectName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: Главный корпус"
                  autoFocus
                  required
                />
              </div>
              
              <div className="mb-5">
                <label className="block text-gray-700 font-medium mb-2">Загрузить карту этажа (SVG)</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg"
                    onChange={handleFileSelect}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Загрузите SVG файл с картой этажа (оставьте пустым для карты по умолчанию)
                </p>
                {selectedFile && (
                  <p className="text-green-600 text-sm mt-1">
                    ✅ Выбран файл: {selectedFile.name}
                  </p>
                )}
              </div>

              {selectedFile && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-2">Предпросмотр:</p>
                    <div 
                      className="border rounded-lg p-2 bg-white overflow-auto flex justify-center"
                      style={{ maxHeight: '400px' }}
                      dangerouslySetInnerHTML={{ 
                        __html: selectedFile.content.replace(
                          /<svg\s+/i, 
                          '<svg width="100%" style="max-height: 380px" '
                        )
                      }}
                    />
                  </div>
                )}
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-500 text-white px-5 py-2 rounded-xl hover:bg-green-600 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Создание...' : 'Создать объект'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setError('');
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl hover:bg-gray-300 font-medium"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Сетка объектов */}
        {uniqueObjects.length === 0 && !showAddForm ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-medium text-gray-700">Нет добавленных объектов</h3>
            <p className="text-gray-400 mt-2">Нажмите кнопку "Добавить объект", чтобы начать</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {uniqueObjects.map((obj: UniqueObject) => (
              <div
                key={obj.place}
                onClick={() => handleObjectClick(obj.place)}
                className="group cursor-pointer transform transition-all duration-200 hover:scale-105"
              >
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl overflow-hidden border border-gray-100 hover:border-blue-200">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  
                  <div className="flex justify-center pt-6 pb-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="text-center px-4 py-3">
                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600">
                      {obj.place}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {obj.floorsCount} {obj.floorsCount === 1 ? 'этаж' : 'этажей'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ObjectsList;