// src/components/LendingForm.tsx
import React, { useState, useEffect } from 'react';
import { lendingAPI } from '../services/api';
import { Lending } from '../types/lending';
import { X, User, DollarSign, Calendar, FileText } from 'lucide-react';

interface LendingFormProps {
  open: boolean;
  onClose: () => void;
  lending?: Lending | null;
  onSuccess: (newLending?: Lending) => void; // ✅ Accept new lending data
}

const LendingForm: React.FC<LendingFormProps> = ({ open, onClose, lending, onSuccess }) => {
  const [formData, setFormData] = useState({
    type: 'lend',
    personName: '',
    amount: '',
    description: '',
    dueDate: '',
    status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lending) {
      setFormData({
        type: lending.type,
        personName: lending.personName,
        amount: lending.amount.toString(),
        description: lending.description || '',
        dueDate: lending.dueDate ? lending.dueDate.split('T')[0] : '',
        status: lending.status
      });
    } else {
      setFormData({
        type: 'lend',
        personName: '',
        amount: '',
        description: '',
        dueDate: '',
        status: 'pending'
      });
    }
    setError('');
  }, [lending, open]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    const data = {
      ...formData,
      amount: parseFloat(formData.amount),
      dueDate: formData.dueDate || undefined
    };

    let response;
    if (lending) {
      // Get the response from update API
      response = await lendingAPI.updateLending(lending._id, data);
      console.log('Update response:', response);
    } else {
      // Get the response from create API
      response = await lendingAPI.createLending(data);
      console.log('Create response:', response);
    }

    // ✅ Pass the created/updated lending data back to parent
    if (response && response.lending) {
      onSuccess(response.lending); // Pass the lending object
    } else {
      onSuccess(); // Fallback if no lending data in response
    }
    
    onClose();
  } catch (err: any) {
    console.error('Form submission error:', err);
    setError(err.response?.message || 'Failed to save record');
  } finally {
    setLoading(false);
  }
};
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">
              {lending ? 'Edit Record' : 'Add New Record'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl">
              <div className="flex items-center">
                <span className="text-rose-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'lend' })}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                    formData.type === 'lend'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="text-lg mb-1">📤</div>
                    <span className="font-semibold">I Lent</span>
                    <span className="text-xs mt-1">Money given to someone</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'borrow' })}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                    formData.type === 'borrow'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="text-lg mb-1">📥</div>
                    <span className="font-semibold">I Borrowed</span>
                    <span className="text-xs mt-1">Money taken from someone</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Person Name */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Person Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.personName}
                  onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter person's name"
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Amount (PKR)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter amount"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Description (Optional)
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 resize-none"
                  placeholder="Add a note or description"
                  rows={3}
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">
                Due Date (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 px-4 rounded-xl text-white font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                  formData.type === 'lend'
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                    {lending ? 'Updating...' : 'Creating...'}
                  </div>
                ) : (
                  lending ? 'Update Record' : 'Create Record'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LendingForm;