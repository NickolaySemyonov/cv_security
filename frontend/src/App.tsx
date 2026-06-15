import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import ObjectsList from './components/ObjectsList';
import FloorPage from './components/FloorPage';
import FloorSetup from './components/FloorSetup';
import FloorCameras from './components/FloorCameras';
import IncidentsList from './components/IncidentsList';

interface User {
  id: number;
  login: string;
  role: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/objects" /> : <Login onLoginSuccess={handleLogin} />
          } 
        />
        <Route 
          path="/objects" 
          element={
            <PrivateRoute>
              <ObjectsList user={user} onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/objects/:place/floors" 
          element={
            <PrivateRoute>
              <FloorPage user={user} onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/floors/:id/setup" 
          element={
            <PrivateRoute>
              <FloorSetup user={user} onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/floors/:id/cameras" 
          element={
            <PrivateRoute>
              <FloorCameras user={user} onLogout={handleLogout} />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/incidents" 
          element={
            <PrivateRoute>
              <IncidentsList user={user} />
            </PrivateRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/objects" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;