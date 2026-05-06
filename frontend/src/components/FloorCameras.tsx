// frontend/src/components/FloorCameras.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios';
import Header from './Header';
import Footer from './Footer';

interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface User {
  id: number;
  login: string;
}

interface FloorCamerasProps {
  user: User | null;  // ← ДОБАВИТЬ user
  onLogout: () => void;
}

const FloorCameras = ({ user, onLogout }: FloorCamerasProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFloor();
  }, [id]);

  const fetchFloor = async () => {
    try {
      const response = await api.get(`/floors/${id}`);
      setFloor(response.data);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToFloor = () => {
    navigate(`/objects/${encodeURIComponent(floor?.place || '')}/floors`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header user={user} onLogout={onLogout} title="Добавление камер" />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-xl text-gray-600">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header user={user} onLogout={onLogout} title={`Добавление камер: ${floor?.place} - Этаж ${floor?.number}`} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-grow">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Добавление камер</h1>
            <button
              onClick={handleBackToFloor}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              ← Вернуться к этажу
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6">
            {/* Карта этажа */}
            <div className="border rounded-lg p-4 bg-gray-50 mb-6">
              <p className="text-sm text-gray-500 mb-2">Карта этажа:</p>
              <div 
                className="overflow-auto max-h-96 bg-white rounded-lg p-2"
                dangerouslySetInnerHTML={{ __html: floor?.map || '' }}
              />
            </div>

            {/* Заглушка */}
            <div className="p-8 bg-gray-50 rounded-xl text-center border-2 border-dashed border-gray-300">
              <svg 
                className="w-16 h-16 text-gray-400 mx-auto mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Функционал в разработке
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Здесь будет реализовано добавление камер, настройка зон видимости и калибровка гомографии.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  🎥 Добавление камер
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  📐 Зоны видимости
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  🔄 Гомография
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FloorCameras;