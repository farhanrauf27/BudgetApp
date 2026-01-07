import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import TabCloseHandler from './services/tabCloseHandler';
import cache from './services/cache';

// Data Context
const DataContext = React.createContext<{
  refreshData: () => void;
  clearCache: () => void;
}>({
  refreshData: () => {},
  clearCache: () => {}
});

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      setIsChecking(true);
      
      // Check if tab was recently closed
      const shouldLogout = TabCloseHandler.checkSessionOnLoad();
      
      // Check for active session
      const hasSession = sessionManager.hasSession();
      
      if (shouldLogout || !hasSession) {
        console.log('Session expired or tab closed, redirecting to login');
        cache.clearCurrentUserCache();
        localStorage.clear(); // Clear all localStorage on tab close
        navigate('/login', { replace: true });
      }
      
      setIsChecking(false);
    };

    checkSession();

    // Setup activity tracking
    const updateActivity = () => {
      localStorage.setItem('last_activity', Date.now().toString());
      sessionManager.updateSessionTimestamp();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Checking session...</p>
        </div>
      </div>
    );
  }

  return sessionManager.hasSession() ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check both session and token
    const hasToken = !!localStorage.getItem('token');
    const hasSession = sessionManager.hasSession();
    return hasToken && hasSession;
  });
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize app
  useEffect(() => {
    // Setup tab close detection
    TabCloseHandler.setupTabCloseDetection();
    
    // Clear expired sessions on app start
    const shouldLogout = TabCloseHandler.checkSessionOnLoad();
    if (shouldLogout) {
      handleFullLogout();
    }
    
    // Check initial authentication state
    const checkAuth = () => {
      const hasToken = !!localStorage.getItem('token');
      const hasSession = sessionManager.hasSession();
      setIsAuthenticated(hasToken && hasSession);
    };
    
    checkAuth();
    console.log('App initialized with tab close protection');
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    handleFullLogout();
  }, []);

  // Complete logout function
  const handleFullLogout = () => {
    // Mark as manual logout to prevent tab close detection
    TabCloseHandler.manualLogout();
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear session and cache
    sessionManager.clearSession();
    cache.clearCurrentUserCache();
    
    console.log('User logged out successfully');
    
    // Update auth state and redirect
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  };

  // Handle navigation
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // Navigation items
  const navigation = useMemo(() => [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Transactions', path: '/transactions', icon: '💳' },
    { name: 'Lending & Borrowing', path: '/lendings', icon: '🤝' },
    { name: 'Analytics', path: '/analytics', icon: '📈' },
    { name: 'Change Password', path: '/change-password', icon: '🔒' },
  ], []);

  // Context value
  const dataContextValue = useMemo(() => ({
    refreshData: () => console.log('Refresh data triggered'),
    clearCache: () => cache.clearCurrentUserCache()
  }), []);

  // Handle login
  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
    navigate('/');
  }, [navigate]);

  // Handle register
  const handleRegister = useCallback(() => {
    setIsAuthenticated(true);
    navigate('/');
  }, [navigate]);

  // Render navigation items
  const renderNavItem = useCallback((item: { name: string; path: string; icon: string }) => {
    const isActive = location.pathname === item.path;
    return (
      <button
        key={item.name}
        onClick={() => handleNavigate(item.path)}
        className={`flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer text-sm ${
          isActive
            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-500/30 shadow-inner'
            : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
        }`}
      >
        <span className="mr-1.5 text-base">{item.icon}</span>
        {item.name}
      </button>
    );
  }, [location.pathname, handleNavigate]);

  // Authenticated routes
  const AuthenticatedRoutes = useMemo(() => (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/transactions" element={
        <ProtectedRoute>
          <TransactionList />
        </ProtectedRoute>
      } />
      <Route path="/analytics" element={
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      } />
      <Route path="/lendings" element={
        <ProtectedRoute>
          <LendingList />
        </ProtectedRoute>
      } />
      <Route path="/change-password" element={
        <ProtectedRoute>
          <ChangePassword />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ), []);

  // Unauthenticated routes
  const UnauthenticatedRoutes = useMemo(() => (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/register" element={<Register onRegister={handleRegister} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  ), [handleLogin, handleRegister]);

  return (
    <DataContext.Provider value={dataContextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* Navigation Bar */}
        {isAuthenticated && (
          <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14">
                {/* Logo */}
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-2 rounded-lg shadow-lg">
                    <span className="text-white text-lg">💰</span>
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-white tracking-tight">BudgetTracker</h1>
                    <p className="text-xs text-cyan-300/80">Manage your finances</p>
                  </div>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-1">
                  {navigation.map(renderNavItem)}
                </div>

                {/* Right Section */}
                <div className="flex items-center space-x-3">
                  {/* Desktop User Section */}
                  <div className="hidden md:flex items-center space-x-3">
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/30 rounded-lg border border-slate-600/50">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-slate-300 text-sm">Online</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center px-3 py-1.5 bg-gradient-to-r from-rose-600/90 to-pink-600/90 hover:from-rose-700 hover:to-pink-700 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm cursor-pointer"
                    >
                      <span className="mr-1.5">🚪</span>
                      Logout
                    </button>
                  </div>

                  {/* Mobile Menu Button */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                      className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/30 transition-colors duration-200 cursor-pointer"
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

              {/* Mobile Menu */}
              {isMobileMenuOpen && (
                <div className="md:hidden bg-gradient-to-b from-slate-800 to-slate-900 border-t border-slate-700/50 shadow-2xl animate-slideDown">
                  <div className="px-3 pt-2 pb-3 space-y-1">
                    {navigation.map(item => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.name}
                          onClick={() => handleNavigate(item.path)}
                          className={`flex items-center w-full text-left px-4 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${
                            isActive
                              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200'
                              : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
                          }`}
                        >
                          <span className="mr-3 text-base">{item.icon}</span>
                          {item.name}
                        </button>
                      );
                    })}

                    {/* Mobile Logout */}
                    <div className="pt-2 border-t border-slate-700/50 mt-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-2.5 rounded-lg font-medium bg-gradient-to-r from-rose-600/20 to-pink-600/20 text-rose-300 hover:text-white hover:from-rose-700/30 hover:to-pink-700/30 transition-all duration-200 cursor-pointer"
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
        <div className={isAuthenticated ? 'py-8' : 'min-h-screen flex items-center justify-center'}>
          <div className={isAuthenticated ? '' : 'w-full'}>
            {isAuthenticated ? AuthenticatedRoutes : UnauthenticatedRoutes}
          </div>
        </div>
      </div>
    </DataContext.Provider>
  );
};

export default React.memo(App);