import { useState, useEffect } from 'react';
import api from '../config/axios';

interface Operator {
  id: number;
  login: string;
  role: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchOperators();
    }
  }, [isOpen]);

  const fetchOperators = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/operators');
      setOperators(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки операторов:', error);
      let errorMsg = 'Ошибка загрузки операторов';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newLogin.trim()) {
      setError('Введите логин');
      return;
    }
    if (!newPassword.trim()) {
      setError('Введите пароль');
      return;
    }
    if (newPassword.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await api.post('/users/register-operator', {
        login: newLogin.trim(),
        password: newPassword
      });
      
      await fetchOperators();
      setNewLogin('');
      setNewPassword('');
      setError('');
    } catch (error: any) {
      console.error('Ошибка создания:', error);
      
      let errorMsg = 'Ошибка создания оператора';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOperator = async (userId: number, login: string) => {
    if (!window.confirm(`Удалить оператора "${login}"?`)) return;
    
    try {
      const response = await api.delete(`/users/${userId}`);
      if (response.status === 200) {
        await fetchOperators();
        alert(`Оператор "${login}" успешно удалён`);
      }
    } catch (error: any) {
      console.error('Ошибка удаления:', error);
      let errorMsg = 'Ошибка при удалении оператора';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      alert(errorMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scaleIn">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Управление операторами</h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-lg">➕</span> Создать оператора
          </h3>
          <form onSubmit={handleCreateOperator} className="space-y-3">
            <input
              type="text"
              placeholder="Логин"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              disabled={submitting}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              disabled={submitting}
            />
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-2.5 rounded-xl font-medium hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 transition-all shadow-md shadow-purple-200"
            >
              {submitting ? 'Создание...' : 'Создать оператора'}
            </button>
          </form>
        </div>

        <div className="border-t border-gray-100 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-lg">📋</span> Список операторов
          </h3>
          {loading ? (
            <div className="text-center text-gray-400 py-6">Загрузка...</div>
          ) : operators.length === 0 ? (
            <div className="text-center text-gray-400 py-6">Нет операторов</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {operators.map(op => (
                <div key={op.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{op.login[0].toUpperCase()}</span>
                    </div>
                    <span className="text-gray-700 font-medium">{op.login}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteOperator(op.id, op.login)}
                    className="text-red-500 hover:text-red-700 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;