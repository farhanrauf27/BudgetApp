import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import sessionManager from '../services/sessionManager';
import cache from '../services/cache';

interface LoginProps {
  onLogin: () => void;
}

interface LoginResponse {
  token: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  // Add these fields to match your backend response
  data?: {
    token: string;
    user: {
      _id: string;
      name: string;
      email: string;
    };
  };
  message?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await authAPI.login(formData) as LoginResponse;
      
      console.log('Login response:', response);
      
      let token: string;
      let userId: string;
      let userName: string;
      
      // Handle different response structures
      if (response.token) {
        // Structure 1: Direct token and user
        token = response.token;
        userId = response.user?.id || '';
        userName = response.user?.name || '';
      } else if (response.data?.token) {
        // Structure 2: Nested in data object
        token = response.data.token;
        userId = response.data.user?._id || '';
        userName = response.data.user?.name || '';
      } else if (response.data && typeof response.data === 'string') {
        // Structure 3: Token as string in data
        token = response.data;
        userId = '';
        userName = '';
      } else {
        throw new Error('Invalid response structure from server');
      }
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      
      // Set user session with proper ID
      // Generate a unique session ID if user ID not available
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.warn('No user ID in response, generated:', userId);
      }
      
      sessionManager.setUserSession(userId);
      
      // Initialize cache for this user
      cache.setUserId(userId);
      
      // Clear any previous user's cache
      cache.clearCurrentUserCache();
      
      // Store user info if available
      if (userName) {
        localStorage.setItem('userName', userName);
      }
      if (userId) {
        localStorage.setItem('userId', userId);
      }
      
      // Store login timestamp for session management
      localStorage.setItem('loginTime', Date.now().toString());
      
      console.log(`Login successful for user ${userId}`);
      
      // Call parent login handler
      onLogin();
      
      // Navigate to dashboard
      navigate('/dashboard');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Clear any existing sessions on error
      sessionManager.clearSession();
      cache.clearCurrentUserCache();
      
      // Extract error message
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (error.response) {
        // Server responded with error
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      setError(errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Add a function to clear existing sessions on component mount
  React.useEffect(() => {
    // Clear any existing sessions when login component mounts
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      // Optional: Validate token or just clear it
      console.log('Clearing existing token on login page mount');
      localStorage.removeItem('token');
    }
    
    // Clear session manager
    sessionManager.clearSession();
    
    // Clear cache
    cache.clearCurrentUserCache();
    
    // Remove any user-specific local storage
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('loginTime');
    
    console.log('Login page: Cleared all previous sessions');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="bg-slate-800/40 backdrop-blur-lg rounded-3xl border border-slate-700/50 shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 rounded-2xl">
                <span className="text-3xl">💰</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              BudgetTracker
            </h1>
            <p className="text-blue-200 text-lg">
              Welcome back! Sign in to continue
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-sm animate-pulse">
              <div className="flex items-center">
                <div className="bg-red-500/20 p-2 rounded-full mr-3">
                  <span className="text-red-400 text-sm">⚠️</span>
                </div>
                <div>
                  <span className="text-red-300 font-medium block">{error}</span>
                  <span className="text-red-400/70 text-xs mt-1 block">
                    Please check your credentials and try again
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-400">📧</span>
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:border-cyan-500/50"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-400">🔒</span>
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:border-cyan-500/50"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-2xl group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {isLoading ? (
                <div className="flex items-center justify-center relative z-10">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                  Signing In...
                </div>
              ) : (
                <div className="flex items-center justify-center relative z-10">
                  <span className="mr-3">🚀</span>
                  Sign In
                </div>
              )}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/forgot-password')}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-300 hover:underline cursor-pointer"
            >
              Forgot your password?
            </button>
          </div>

          {/* Sign Up Link */}
          <div className="text-center mt-8 pt-6 border-t border-slate-700/50">
            <p className="text-slate-400">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-300 hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          </div>

          {/* Debug Info (remove in production) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
              <p className="text-slate-400 text-xs mb-2">Debug Info:</p>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Session: {sessionManager.hasSession() ? 'Active' : 'None'}</span>
                <span>Cache: {cache.getCacheSize()} items</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Secure your financial future with BudgetTracker
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Your data is encrypted and secure
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;