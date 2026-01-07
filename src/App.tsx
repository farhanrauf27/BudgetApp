// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Analytics from './components/Analytics';
import Login from './components/Login';
import Register from './components/Register';
import ChangePassword from './components/ChangePassword';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import LendingList from './components/LendingList';
import sessionManager from './services/sessionManager';
import cache from './services/cache';

// Create a context for shared data
const DataContext = React.createContext<{
  refreshData: () => void;
  clearCache: () => void;
}>({
  refreshData: () => { },
  clearCache: () => { }
});

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Initialize from localStorage
    return !!localStorage.getItem('token');
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize handlers
  const handleLogout = useCallback(() => {
      // Clear all user data
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('loginTime');
      
      // Clear session
      sessionManager.clearSession();
      
      // Clear cache
      cache.clearCurrentUserCache();
      
      console.log('User logged out successfully');
      
      // Redirect to login
      window.location.href = '/login';
    }, []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // Memoize navigation items
  const navigation = React.useMemo(() => [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Transactions', path: '/transactions', icon: '💳' },
    { name: 'Lending & Borrowing', path: '/lendings', icon: '🤝' }, // Add this
    { name: 'Analytics', path: '/analytics', icon: '📈' },
    { name: 'Change Password', path: '/change-password', icon: '🔒' },
  ], []);

  // Create context value
  const dataContextValue = React.useMemo(() => ({
    refreshData: () => {
      // This will be implemented in each component
      console.log('Refresh data triggered');
    },
    clearCache: () => {
      // Clear cache on logout
      import('./services/cache').then(module => {
        const cache = module.default;
        cache.clear();
      });
    }
  }), []);

  // Wrap routes in React.memo to prevent unnecessary re-renders
  const AuthenticatedRoutes = React.memo(() => (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/transactions" element={<TransactionList />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
        <Route
          path="/lendings"
          element={isAuthenticated ? <LendingList /> : <Navigate to="/login" />}
        />
    </Routes>
  ));

  const UnauthenticatedRoutes = React.memo(() => (
    <Routes>
      <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
      <Route path="/register" element={<Register onRegister={() => setIsAuthenticated(true)} />} />
      <Route
        path="/forgot-password"
        element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />}
      />
      <Route
        path="/reset-password/:token"
        element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  ));

  return (
    <DataContext.Provider value={dataContextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* Navigation Bar - Only show if authenticated */}
        {isAuthenticated && (
  <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 shadow-lg">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-14">
        {/* Logo/Brand - Compact */}
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-2 rounded-lg shadow-lg">
            <span className="text-white text-lg">💰</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white tracking-tight">BudgetTracker</h1>
            <p className="text-xs text-cyan-300/80">Manage your finances</p>
          </div>
        </div>

        {/* Desktop Navigation Links - Compact */}
        <div className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer text-sm ${isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-500/30 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
                  }`}
              >
                <span className="mr-1.5 text-base">{item.icon}</span>
                {item.name}
              </button>
            );
          })}
        </div>

        {/* Right Section - Compact */}
        <div className="flex items-center space-x-3">
          {/* Desktop User Section */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/30 rounded-lg border border-slate-600/50">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-slate-300 text-sm">Online</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-1.5 bg-gradient-to-r from-rose-600/90 to-pink-600/90 hover:from-rose-700 hover:to-pink-700 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
            >
              <span className="mr-1.5">🚪</span>
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/30 transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Compact */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-slate-700/50 shadow-2xl animate-slideDown">
          <div className="px-3 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigate(item.path)}
                  className={`flex items-center w-full text-left px-4 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
                    }`}
                >
                  <span className="mr-3 text-base">{item.icon}</span>
                  {item.name}
                </button>
              );
            })}

            {/* Mobile Logout Button */}
            <div className="pt-2 border-t border-slate-700/50 mt-2">
              <button
                onClick={handleLogout}
                className="flex items-center w-full text-left px-4 py-2.5 rounded-lg font-medium bg-gradient-to-r from-rose-600/20 to-pink-600/20 text-rose-300 hover:text-white hover:from-rose-700/30 hover:to-pink-700/30 transition-all duration-200"
              >
                <span className="mr-3">🚪</span>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </nav>
)}

        {/* Main Content */}
        <div className={`${isAuthenticated ? 'py-8' : 'min-h-screen flex items-center justify-center'}`}>
          <div className={isAuthenticated ? '' : 'w-full'}>
            {isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
          </div>
        </div>

        {/* Footer for authenticated users */}
        {isAuthenticated && (
          <footer className="bg-slate-800/50 border-t border-slate-700/30 mt-16">
            {/* Your existing footer code... */}
          </footer>
        )}
      </div>
    </DataContext.Provider>
  );
};

export default React.memo(App);