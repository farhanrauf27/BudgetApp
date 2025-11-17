// src/App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Analytics from './components/Analytics';
import Login from './components/Login';
import Register from './components/Register';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Transactions', path: '/transactions', icon: '💳' },
    { name: 'Analytics', path: '/analytics', icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Navigation Bar */}
      {isAuthenticated && (
        <nav className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700/50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo/Brand */}
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-2 rounded-xl mr-3">
                  <span className="text-white text-xl">💰</span>
                </div>
                <h1 className="text-2xl font-bold text-white">BudgetTracker</h1>
              </div>

              {/* Navigation Links */}
              <div className="flex items-center space-x-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.name}
                    </button>
                  );
                })}
              </div>

              {/* User Section */}
              <div className="flex items-center space-x-4">
                <div className="text-slate-300 text-sm">
                  Welcome back!
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 px-4 py-2 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <span className="flex items-center">
                    <span className="mr-2">🚪</span>
                    Logout
                  </span>
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className={`${isAuthenticated ? 'py-8' : 'min-h-screen flex items-center justify-center'}`}>
        <div className={isAuthenticated ? '' : 'w-full'}>
          <Routes>
            <Route
              path="/login"
              element={!isAuthenticated ? <Login onLogin={() => setIsAuthenticated(true)} /> : <Navigate to="/" />}
            />
            <Route
              path="/register"
              element={!isAuthenticated ? <Register onRegister={() => setIsAuthenticated(true)} /> : <Navigate to="/" />}
            />
            <Route 
              path="/" 
              element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/transactions" 
              element={isAuthenticated ? <TransactionList /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/analytics" 
              element={isAuthenticated ? <Analytics /> : <Navigate to="/login" />} 
            />
            <Route 
              path="*" 
              element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} 
            />
          </Routes>
        </div>
      </div>

      {/* Footer for authenticated users */}
      {isAuthenticated && (
        <footer className="bg-slate-800/50 border-t border-slate-700/30 mt-16">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div className="text-slate-400 text-sm">
                © 2024 BudgetTracker. Manage your finances with ease.
              </div>
              <div className="flex space-x-4">
                <button className="text-slate-400 hover:text-cyan-300 transition-colors duration-300">
                  Help
                </button>
                <button className="text-slate-400 hover:text-cyan-300 transition-colors duration-300">
                  About
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;