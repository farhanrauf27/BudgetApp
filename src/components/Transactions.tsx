import React, { useState, useEffect } from 'react';
import { transactionAPI } from '../services/api';
import { Transaction } from '../types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  onTransactionUpdated: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  open, 
  onClose, 
  editingTransaction,
  onTransactionUpdated 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  // const categories = {
  //   income: ['Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other'],
  //   expense: ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Other'],
  // };

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        name: editingTransaction.name || '',
        type: editingTransaction.type || 'income',
        amount: editingTransaction.amount.toString() || '',
        category: editingTransaction.category || '',
        description: editingTransaction.description || '',
        date: editingTransaction.date ? editingTransaction.date.split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } else {
      // Reset form when adding new transaction
      setFormData({
        name: '',
        type: 'income',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
  }, [editingTransaction, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: formData.date,
      };

      if (editingTransaction && editingTransaction._id) {
        await transactionAPI.updateTransaction(editingTransaction._id, transactionData);
      } else {
        await transactionAPI.createTransaction(transactionData);
      }
      
      onTransactionUpdated();
      onClose();
      setFormData({
        name: '',
        type: 'income',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'type' && { category: '' }),
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-scaleIn">
        {/* Compact Header */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-t-2xl">
          <div className="absolute top-3 right-3">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors duration-200 p-1 rounded-full hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {editingTransaction ? 'Update your transaction' : 'Quick financial tracking'}
            </p>
          </div>
        </div>

        {/* Compact Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm"
              placeholder="Transaction name"
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange('type', 'income')}
                className={`p-2 rounded-lg border transition-all duration-200 font-medium text-sm ${
                  formData.type === 'income'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-300'
                }`}
              >
                💰 Income
              </button>
              <button
                type="button"
                onClick={() => handleChange('type', 'expense')}
                className={`p-2 rounded-lg border transition-all duration-200 font-medium text-sm ${
                  formData.type === 'expense'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-rose-300'
                }`}
              >
                💸 Expense
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (PKR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                ₨
              </span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
                min="0"
                step="0.01"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Category */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm"
            >
              <option value="">Select a category</option>
              {categories[formData.type].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div> */}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm resize-none"
              placeholder="Additional details..."
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              required
              max={today}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cannot select future dates
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 font-medium text-sm shadow-lg hover:shadow-xl"
            >
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;