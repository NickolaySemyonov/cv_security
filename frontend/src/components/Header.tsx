import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogsModal from './LogsModal';
import AdminPanel from './AdminPanel';

interface User {
  id: number;
  login: string;
  role: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  title?: string;
}

const Header = ({ user, onLogout, title = "Система мониторинга" }: HeaderProps) => {
  const navigate = useNavigate();
  const [showLogs, setShowLogs] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const handleLogoClick = () => {
    navigate('/objects');
  };

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';

  return (
    <>
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div onClick={handleLogoClick} className="cursor-pointer transition-transform hover:scale-105">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
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
            )}

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                title="Управление операторами"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="hidden sm:inline">Админ</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                isAdmin ? 'bg-purple-500' : 'bg-blue-500'
              }`}>
                {user?.login?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-gray-700 font-medium hidden sm:inline">{user?.login}</span>
              {isAdmin && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full hidden sm:inline">
                  Админ
                </span>
              )}
              {isOperator && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full hidden sm:inline">
                  Оператор
                </span>
              )}
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

      {isAdmin && (
        <>
          <LogsModal isOpen={showLogs} onClose={() => setShowLogs(false)} />
          <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} />
        </>
      )}
    </>
  );
};

export default Header;