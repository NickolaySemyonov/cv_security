// frontend/src/components/AdminPanel.tsx
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
      await api.delete(`/users/${userId}`);
      await fetchOperators();
    } catch (error: any) {
      console.error('Ошибка удаления:', error);
      let errorMsg = 'Ошибка при удалении оператора';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      }
      alert(errorMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">👥 Управление операторами</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <h3 className="font-medium text-gray-700 mb-2">➕ Создать оператора</h3>
          <form onSubmit={handleCreateOperator} className="space-y-3">
            <input
              type="text"
              placeholder="Логин"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
            {error && (
              <div className="bg-red-50 text-red-700 p-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Создание...' : 'Создать оператора'}
            </button>
          </form>
        </div>

        <div className="border-t border-gray-200 p-4">
          <h3 className="font-medium text-gray-700 mb-2">📋 Список операторов</h3>
          {loading ? (
            <div className="text-center text-gray-500 py-4">Загрузка...</div>
          ) : operators.length === 0 ? (
            <div className="text-center text-gray-500 py-4">Нет операторов</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {operators.map(op => (
                <div key={op.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{op.login}</span>
                  <button
                    onClick={() => handleDeleteOperator(op.id, op.login)}
                    className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
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