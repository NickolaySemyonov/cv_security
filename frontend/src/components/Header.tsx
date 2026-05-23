// frontend/src/components/Header.tsx (обновленный)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogsModal from './LogsModal';

interface User {
  id: number;
  login: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  title?: string;
}

const Header = ({ user, onLogout, title = "Система мониторинга" }: HeaderProps) => {
  const navigate = useNavigate();
  const [showLogs, setShowLogs] = useState(false);

  const handleLogoClick = () => {
    navigate('/objects');
  };

  return (
    <>
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* Логотип / Название */}
          <div 
            onClick={handleLogoClick}
            className="cursor-pointer transition-transform hover:scale-105"
          >
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          
          {/* Правая часть */}
          <div className="flex items-center gap-4">
            {/* Кнопка логов */}
            <button
              onClick={() => setShowLogs(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Журнал действий"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 2v4h4" />
              </svg>
              <span className="hidden sm:inline">Логи</span>
            </button>

            {/* Пользователь */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.login?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-gray-700 font-medium hidden sm:inline">{user?.login}</span>
            </div>

            {/* Кнопка выхода */}
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all duration-200"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Модальное окно логов */}
      <LogsModal isOpen={showLogs} onClose={() => setShowLogs(false)} />
    </>
  );
};

export default Header;