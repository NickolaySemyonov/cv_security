import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import SvgPreview from './SvgPreview';
import FileInput from './FileInput';
import ObjectCard from './ObjectCard';
import Header from './Header';
import Footer from './Footer';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import { useAlert } from './CustomAlert';

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

const ObjectsList = ({ user, onLogout }: ObjectsListProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert, AlertComponent } = useAlert();
  const { confirm, isOpen: confirmOpen, options, handleConfirm, handleCancel } = useConfirm();
  
  const [floors, setFloors] = useState<Floor[]>([]);
  const [uniqueObjects, setUniqueObjects] = useState<UniqueObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newObjectName, setNewObjectName] = useState<string>('');
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
      const response = await api.get<Floor[]>('/floors/');
      console.log('📦 Загружены этажи:', response.data);
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
    
    if (!selectedFile) {
      setError('Необходимо загрузить карту этажа (SVG файл)');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    const requestData = {
      number: 1,
      place: newObjectName.trim(),
      map: selectedFile.content
    };
    
    try {
      const response = await api.post<Floor>('/floors/', requestData);
      await fetchFloors();
      setShowAddForm(false);
      setNewObjectName('');
      resetForm();
      showAlert('Объект успешно добавлен', 'success');
    } catch (err: any) {
      let errorMsg = 'Ошибка при добавлении объекта';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      showAlert(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteObject = async (place: string): Promise<void> => {
    const confirmed = await confirm({
      title: 'Удаление объекта',
      message: `Удалить объект "${place}" и все его этажи? Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      const floorsToDelete = floors.filter(f => f.place === place);
      
      for (const floor of floorsToDelete) {
        await api.delete(`/floors/${floor.id}`);
      }
      
      await fetchFloors();
      showAlert(`Объект "${place}" успешно удалён`, 'success');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Ошибка при удалении объекта';
      setError(errorMsg);
      showAlert(errorMsg, 'error');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRenameObject = async (oldPlace: string, newPlace: string): Promise<void> => {
    await fetchFloors();
    showAlert(`Объект переименован из "${oldPlace}" в "${newPlace}"`, 'success');
  };

  const handleObjectClick = (place: string): void => {
    navigate(`/objects/${encodeURIComponent(place)}/floors`);
  };

  const handleAddFloor = async (place: string, currentFloorsCount: number): Promise<void> => {
    await fetchFloors();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex justify-center items-center">
        <div className="text-xl text-gray-400">Загрузка объектов...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex flex-col">
      {AlertComponent}
      <ConfirmModal
        isOpen={confirmOpen}
        title={options?.title || ''}
        message={options?.message || ''}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        confirmVariant={options?.confirmVariant || 'danger'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
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
                className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-500/25 flex items-center gap-2 font-medium"
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
                <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-6 mb-8 shadow-xl">
                  <h2 className="text-xl font-semibold text-gray-200 mb-4">Новый объект</h2>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleAddObject}>
                    <div className="mb-4">
                      <label className="block text-gray-300 font-medium mb-2">Название объекта</label>
                      <input
                        type="text"
                        value={newObjectName}
                        onChange={(e) => setNewObjectName(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                        placeholder="Например: Главный корпус"
                        required
                      />
                      <p className="text-gray-500 text-sm mt-1">Будет создан первый этаж</p>
                    </div>
                    
                    <FileInput
                      fileInputRef={fileInputRef}
                      onFileSelect={handleFileSelect}
                      label="Карта этажа (SVG)"
                      helperText="Обязательно загрузите SVG файл карты этажа"
                    />

                    <SvgPreview file={selectedFile} maxHeight="250px" />
                    
                    <div className="flex gap-3 mt-6">
                      <button type="submit" disabled={isSubmitting || !selectedFile} className="bg-gradient-to-r from-green-600 to-green-500 text-white px-5 py-2 rounded-xl font-medium disabled:opacity-50 hover:from-green-700 hover:to-green-600 transition-all duration-200 shadow-lg shadow-green-500/25">
                        {isSubmitting ? 'Сохранение...' : 'Сохранить объект'}
                      </button>
                      <button type="button" onClick={() => {
                        setShowAddForm(false);
                        resetForm();
                      }} className="bg-gray-700 text-gray-300 px-5 py-2 rounded-xl font-medium hover:bg-gray-600 transition-colors">
                        Отмена
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {uniqueObjects.length === 0 && !showAddForm ? (
                <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-12 text-center max-w-2xl mx-auto mt-8 shadow-xl">
                  <div className="text-6xl mb-4">🏢</div>
                  <h3 className="text-xl font-medium text-gray-300">Нет добавленных объектов</h3>
                  <p className="text-gray-500 mt-2">Нажмите "Добавить объект", чтобы начать</p>
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
                        onAddFloor={handleAddFloor}
                        onDeleteObject={handleDeleteObject}
                        onRenameObject={handleRenameObject}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ObjectsList;