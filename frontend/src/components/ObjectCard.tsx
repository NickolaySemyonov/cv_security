import { useState } from 'react';
import api from '../config/axios';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import { useAlert } from './CustomAlert';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface ObjectCardProps {
  place: string;
  floorsCount: number;
  floors?: Floor[];
  onCardClick: (place: string) => void;
  onAddFloor: (place: string, floorsCount: number) => void;
  onDeleteObject: (place: string) => void;
  onRenameObject: (oldPlace: string, newPlace: string) => void;
  isAdmin: boolean;
}

const ObjectCard = ({ 
  place, 
  floorsCount, 
  floors, 
  onCardClick, 
  onAddFloor, 
  onDeleteObject,
  onRenameObject,
  isAdmin
}: ObjectCardProps) => {
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [showRenameForm, setShowRenameForm] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState(place);
  const [newFloorNumber, setNewFloorNumber] = useState<number>(floorsCount + 1);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { confirm, isOpen: confirmOpen, options, handleConfirm, handleCancel } = useConfirm();
  const { showAlert, AlertComponent } = useAlert();

  const handleDeleteObject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmed = await confirm({
      title: 'Удаление объекта',
      message: `Удалить объект "${place}" и все его этажи? Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      confirmVariant: 'danger'
    });
    
    if (confirmed) {
      onDeleteObject(place);
    }
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRenameForm(true);
    setNewPlaceName(place);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newPlaceName.trim()) {
      setError('Введите новое название');
      return;
    }
    
    if (newPlaceName.trim() === place) {
      setShowRenameForm(false);
      return;
    }
    
    setRenaming(true);
    setError('');
    
    try {
      const floorsToUpdate = floors || [];
      for (const floor of floorsToUpdate) {
        await api.patch(`/floors/${floor.id}`, {
          place: newPlaceName.trim()
        });
      }
      
      onRenameObject(place, newPlaceName.trim());
      setShowRenameForm(false);
      showAlert(`Объект переименован в "${newPlaceName.trim()}"`, 'success');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при переименовании');
      showAlert(err.response?.data?.detail || 'Ошибка при переименовании', 'error');
    } finally {
      setRenaming(false);
    }
  };

  const handleAddFloorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFloorForm(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.svg')) {
      setError('Пожалуйста, выберите SVG файл');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
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

  const handleSubmitFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newFloorNumber || newFloorNumber < 0) {
      setError('Введите корректный номер этажа');
      return;
    }
    
    if (!selectedFile) {
      setError('Необходимо загрузить карту этажа (SVG файл)');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const existingFloor = floors?.find(f => f.number === newFloorNumber);
      
      if (existingFloor) {
        setError(`Этаж ${newFloorNumber} у объекта "${place}" уже существует`);
        setIsSubmitting(false);
        return;
      }
      
      await api.post('/floors', {
        number: newFloorNumber,
        place: place,
        map: selectedFile.content
      });
      
      setShowFloorForm(false);
      setSelectedFile(null);
      setNewFloorNumber(floorsCount + 1);
      onAddFloor(place, floorsCount);
      showAlert(`Этаж ${newFloorNumber} успешно добавлен`, 'success');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при добавлении этажа');
      showAlert(err.response?.data?.detail || 'Ошибка при добавлении этажа', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelForm = () => {
    setShowFloorForm(false);
    setShowRenameForm(false);
    setSelectedFile(null);
    setError('');
  };

  return (
    <>
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
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-600/50 overflow-hidden transition-all duration-200 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-gray-500 relative group shadow-xl">
        <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={handleRenameClick}
              className="p-2 bg-blue-500/20 text-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500/30 z-10"
              title="Переименовать объект"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDeleteObject}
              className="p-2 bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30 z-10"
              title="Удалить объект"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
        
        <div 
          onClick={() => onCardClick(place)}
          className="cursor-pointer text-center pt-6 pb-4"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto transition-transform hover:scale-110">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="font-bold text-xl text-gray-200 mt-3">{place}</h3>
          <p className="text-sm text-gray-500">
            {floorsCount} {floorsCount === 1 ? 'этаж' : 'этажей'}
          </p>
        </div>
        
        <div className="px-4 pb-4">
          {isAdmin && (
            <button
              onClick={handleAddFloorClick}
              className="w-full text-sm bg-gray-700/50 text-blue-400 py-2 rounded-xl hover:bg-gray-700 transition-colors"
            >
              + Добавить этаж
            </button>
          )}
        </div>
      </div>

      {showRenameForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-600" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-gray-200">Переименовать объект</h2>
              <button onClick={cancelForm} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleRenameSubmit} className="p-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-gray-300 font-medium mb-2">Новое название объекта</label>
                <input
                  type="text"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите новое название"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={renaming}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-2 rounded-xl font-medium disabled:opacity-50 hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-500/25"
                >
                  {renaming ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 bg-gray-700 text-gray-300 px-5 py-2 rounded-xl font-medium hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFloorForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto border border-gray-600" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-gray-200">Добавить этаж к "{place}"</h2>
              <button onClick={cancelForm} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitFloor} className="p-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-gray-300 font-medium mb-2">Номер этажа</label>
                <input
                  type="number"
                  value={newFloorNumber}
                  onChange={(e) => setNewFloorNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-300 font-medium mb-2">Карта этажа (SVG)</label>
                <input
                  type="file"
                  accept=".svg"
                  onChange={handleFileSelect}
                  className="w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30"
                  required
                />
                <p className="text-gray-500 text-sm mt-1">Обязательно загрузите SVG файл карты этажа</p>
              </div>
              
              {selectedFile && (
                <div className="mt-3 p-3 bg-gray-900/50 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">✓ Выбран файл: {selectedFile.name}</p>
                  <div 
                    className="border border-gray-600 rounded-lg p-2 bg-gray-900/30 overflow-auto flex justify-center"
                    style={{ maxHeight: '200px' }}
                    dangerouslySetInnerHTML={{ __html: selectedFile.content }}
                  />
                </div>
              )}
            
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white px-5 py-2 rounded-xl font-medium disabled:opacity-50 hover:from-green-700 hover:to-green-600 transition-all duration-200 shadow-lg shadow-green-500/25"
                >
                  {isSubmitting ? 'Сохранение...' : 'Сохранить этаж'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 bg-gray-700 text-gray-300 px-5 py-2 rounded-xl font-medium hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ObjectCard;