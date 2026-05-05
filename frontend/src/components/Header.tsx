// frontend/src/components/Header.tsx
import { useNavigate } from 'react-router-dom';

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

  const handleLogoClick = () => {
    navigate('/objects');
  };

  return (
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
        
        {/* Правая часть: пользователь и кнопка выхода */}
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
  );
};

export default Header;