// frontend/src/components/Footer.tsx
import { useState, useEffect } from 'react';

const Footer = () => {
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Левая часть */}
          <div className="text-sm text-gray-400">
            © {currentYear} Система мониторинга. Все права защищены.
          </div>
          
          {/* Центральная часть */}
          <div className="text-sm text-gray-400">
            Версия 1.0.0
          </div>
          
          {/* Правая часть */}
          <div className="flex gap-4">
            <a 
              href="#" 
              className="text-sm text-gray-400 hover:text-white transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              О системе
            </a>
            <a 
              href="#" 
              className="text-sm text-gray-400 hover:text-white transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Поддержка
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;