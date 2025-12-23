// src/App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Analytics from './components/Analytics';
import Login from './components/Login';
import Register from './components/Register';
import ChangePassword from './components/ChangePassword';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Transactions', path: '/transactions', icon: '💳' },
    { name: 'Analytics', path: '/analytics', icon: '📈' },
    { name: 'Change Password', path: '/change-password', icon: '🔒' },
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
                <h1 className="text-2xl font-bold text-white hidden sm:block">BudgetTracker</h1>
                <h1 className="text-2xl font-bold text-white sm:hidden">BT</h1>
              </div>

              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center space-x-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-300 cursor-pointer ${
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

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors duration-300"
                >
                  {isMobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Desktop User Section */}
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-slate-300 text-sm">
                  Welcome back!
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r cursor-pointer from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 px-4 py-2 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <span className="flex items-center">
                    <span className="mr-2">🚪</span>
                    Logout
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
              <div className="md:hidden bg-slate-800/90 backdrop-blur-lg border-t border-slate-700/50 mt-2 rounded-xl shadow-2xl">
                <div className="px-2 pt-2 pb-3 space-y-1">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavigate(item.path)}
                        className={`flex items-center w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <span className="mr-3 text-lg">{item.icon}</span>
                        {item.name}
                      </button>
                    );
                  })}
                  
                  {/* Mobile Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full text-left px-4 py-3 rounded-lg font-medium bg-gradient-to-r from-rose-600/20 to-pink-600/20 text-rose-300 hover:text-white hover:from-rose-700/30 hover:to-pink-700/30 transition-all duration-300 mt-2"
                  >
                    <span className="mr-3 text-lg">🚪</span>
                    Logout
                  </button>
                </div>
              </div>
            )}
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
              path="/change-password" 
              element={isAuthenticated ? <ChangePassword /> : <Navigate to="/login" />} 
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-slate-400 text-sm text-center md:text-left">
                © 2024 BudgetTracker. Manage your finances with ease.
              </div>
              <div className="flex space-x-4">
                <button 
                  onClick={() => navigate('/change-password')}
                  className="text-slate-400 hover:text-cyan-300 transition-colors duration-300"
                >
                  Change Password
                </button>
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