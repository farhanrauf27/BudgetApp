// src/components/ForgotPassword.tsx
import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await authAPI.forgotPassword(email);
      setSuccess(true);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.response?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="absolute -top-16 left-0 flex items-center text-slate-400 hover:text-white transition-colors duration-300"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Login
        </button>

        {/* Main Card */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-2xl">
                <span className="text-3xl">🔐</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Reset Password
            </h1>
            <p className="text-blue-200 text-lg">
              Enter your email to receive a reset link
            </p>
          </div>

          {/* Success Message */}
          {success ? (
            <div className="mb-6 p-6 bg-emerald-500/20 border border-emerald-500/30 rounded-xl backdrop-blur-sm">
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
                <h3 className="text-2xl font-bold text-emerald-300 mb-2">
                  Email Sent!
                </h3>
                <p className="text-emerald-200 mb-4">
                  {message}
                </p>
                <p className="text-slate-300 text-sm">
                  Check your spam folder if you don't see the email in your inbox.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  Return to Login
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Alert */}
              {error && (
                <div className="mb-6 p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center">
                    <AlertCircle className="text-rose-400 mr-3" />
                    <span className="text-rose-300 text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* Info Message */}
              {message && (
                <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center">
                    <span className="text-blue-400 mr-3">ℹ️</span>
                    <span className="text-blue-300 text-sm">{message}</span>
                  </div>
                </div>
              )}

              {/* Forgot Password Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-3">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter your registered email"
                    />
                  </div>
                  <p className="text-slate-400 text-sm mt-2">
                    We'll send you a link to reset your password
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-2xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                      Sending Reset Link...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="mr-3">📧</span>
                      Send Reset Link
                    </div>
                  )}
                </button>
              </form>

              {/* Additional Links */}
              <div className="text-center mt-8 pt-6 border-t border-slate-700/50">
                <p className="text-slate-400">
                  Remember your password?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-300 hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            The reset link will expire in 1 hour for security
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;