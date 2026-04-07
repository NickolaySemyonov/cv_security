// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';

const Dashboard = ({ user, onLogout }) => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Добро пожаловать, {user?.login}!</h1>
      <button onClick={onLogout}>Выйти</button>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/" /> : <Login onLoginSuccess={handleLogin} />
          } 
        />
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <Dashboard user={user} onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;