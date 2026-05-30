import { useState, useEffect } from 'react';
import api from '../config/axios';

interface Action {
  id: number;
  time: string;
  title: string;
  text: string;
  user_id: number;
  user_login: string;
}

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogsModal = ({ isOpen, onClose }: LogsModalProps) => {
  const [logs, setLogs] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterUser, setFilterUser] = useState<string>('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<{ id: number; login: string }[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      fetchUsers();
    }
  }, [isOpen, page, filterUser, search, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (filterUser) params.user_id = filterUser;
      if (search) params.search = search;
      if (dateFrom) params.start_date = new Date(dateFrom).toISOString();
      if (dateTo) params.end_date = new Date(dateTo).toISOString();

      const response = await api.get('/logs/', { params });
      setLogs(response.data.items);
      setTotal(response.data.total);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Ошибка загрузки логов:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/logs/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getTitleColor = (title: string) => {
    if (title.includes('ОШИБКА') || title.includes('УДАЛЕНИЕ')) return 'text-red-600';
    if (title.includes('СОЗДАНИЕ')) return 'text-green-600';
    if (title.includes('ВХОД')) return 'text-blue-600';
    if (title.includes('ОБНОВЛЕНИЕ')) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getTitleIcon = (title: string) => {
    if (title.includes('ОШИБКА')) return '❌';
    if (title.includes('УДАЛЕНИЕ')) return '🗑️';
    if (title.includes('СОЗДАНИЕ')) return '➕';
    if (title.includes('ВХОД')) return '🔑';
    if (title.includes('ОБНОВЛЕНИЕ')) return '✏️';
    return '📝';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scaleIn">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Журнал действий</h2>
              <p className="text-sm text-gray-500">Всего записей: {total}</p>
            </div>
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

        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="🔍 Поиск по действиям..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            
            <select
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Все пользователи</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.login}</option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="С даты"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="По дату"
            />
          </div>

          <div className="flex justify-start mt-3">
            <button
              onClick={() => {
                setSearch('');
                setFilterUser('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-gray-400">Загрузка логов...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-6xl mb-4">📭</div>
              <p>Нет записей в журнале</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-lg">{getTitleIcon(log.title)}</span>
                        <span className={`font-semibold ${getTitleColor(log.title)}`}>
                          {log.title}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                          {formatDate(log.time)}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-2">{log.text}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {log.user_login}
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          ID: {log.id}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 p-4 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl disabled:opacity-50 hover:bg-gray-200 transition-all"
            >
              ← Назад
            </button>
            
            <span className="text-sm text-gray-600">
              Страница {page} из {totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl disabled:opacity-50 hover:bg-gray-200 transition-all"
            >
              Вперед →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsModal;