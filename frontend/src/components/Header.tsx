import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LogsModal from './LogsModal';
import AdminPanel from './AdminPanel';
import NotificationPanel from './NotificationPanel';

interface User {
  id: number;
  login: string;
  role: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  title?: string;
  onAreaBlink?: (areaId: number | null) => void;
}

const Header = ({ user, onLogout, title = "CV Security", onAreaBlink }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogs, setShowLogs] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogoClick = () => {
    navigate('/objects');
  };

  const handleIncidentsClick = () => {
    navigate('/incidents');
  };

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogoutClick = () => {
    setShowUserMenu(false);
    onLogout();
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isIncidentsPage = location.pathname === '/incidents';

  return (
    <>
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div 
            onClick={handleLogoClick} 
            className="cursor-pointer group flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
              {title}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleIncidentsClick}
              className={`relative px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                isIncidentsPage 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="hidden sm:inline">Нарушения</span>
            </button>

            <NotificationPanel onAreaBlink={onAreaBlink} />

            {isAdmin && (
              <button
                onClick={() => setShowLogs(true)}
                className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all duration-200 group"
                title="Журнал действий"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="absolute inset-0 rounded-xl bg-blue-500/0 group-hover:bg-blue-500/10 transition-all" />
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all duration-200 group"
                title="Управление операторами"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="absolute inset-0 rounded-xl bg-purple-500/0 group-hover:bg-purple-500/10 transition-all" />
              </button>
            )}

            <div className="h-6 w-px bg-gray-700 mx-1" />

            {/* Выпадающее меню пользователя */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={handleUserMenuToggle}
                className="flex items-center gap-2 group focus:outline-none"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg transition-all group-hover:scale-105 ${
                  isAdmin ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  {user?.login?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-200">{user?.login}</p>
                  <p className="text-xs text-gray-500">{isAdmin ? 'Администратор' : 'Оператор'}</p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Выпадающее меню */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 animate-fadeIn">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="text-sm font-medium text-gray-200">{user?.login}</p>
                    <p className="text-xs text-gray-500">{isAdmin ? 'Администратор' : 'Оператор'}</p>
                  </div>
                  <button
                    onClick={handleLogoutClick}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Выйти
                  </button>
                </div>
              )}
            </div>
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