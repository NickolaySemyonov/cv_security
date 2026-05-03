// frontend/src/components/ObjectsList.jsx
import { useState, useEffect } from 'react';
import api from '../config/axios';

const ObjectsList = ({ user, onLogout }) => {
  const [floors, setFloors] = useState([]);
  const [uniqueObjects, setUniqueObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFloors();
  }, []);

  const fetchFloors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/floors');
      setFloors(response.data);
      
      // Группировка: получаем уникальные place
      const unique = [];
      const placeSet = new Set();
      
      response.data.forEach(floor => {
        if (!placeSet.has(floor.place)) {
          placeSet.add(floor.place);
          unique.push({
            place: floor.place,
            floorsCount: response.data.filter(f => f.place === floor.place).length
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

  const handleObjectClick = (place) => {
    // TODO: переход на страницу с этажами этого объекта
    console.log(`Нажат объект: ${place}`);
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
      {/* Шапка */}
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

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Сетка объектов */}
        {uniqueObjects.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-medium text-gray-700">Нет добавленных объектов</h3>
            <p className="text-gray-400 mt-2">Объекты появятся здесь после добавления этажей</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {uniqueObjects.map((obj) => (
              <div
                key={obj.place}
                onClick={() => handleObjectClick(obj.place)}
                className="group cursor-pointer transform transition-all duration-200 hover:scale-105"
              >
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl overflow-hidden border border-gray-100 hover:border-blue-200 transition-all">
                  {/* Верхняя цветная полоса */}
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  
                  {/* Иконка */}
                  <div className="flex justify-center pt-6 pb-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Название объекта */}
                  <div className="text-center px-4 py-3">
                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
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