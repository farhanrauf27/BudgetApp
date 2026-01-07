import React, { useState, useEffect, useCallback } from 'react';
import { Delete, Edit, TrendingUp, TrendingDown, Wallet, Loader, Calendar } from 'lucide-react';
import { transactionAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionForm from './Transactions';
import { Create } from '@mui/icons-material';
import cache from '../services/cache';

// Global state for shared data between components
const transactionGlobalState = {
  allTransactions: [] as Transaction[],
  availableMonths: [] as string[],
  lastFetch: 0
};

const TransactionList: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>(transactionGlobalState.availableMonths);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    incomeCount: 0,
    expenseCount: 0
  });

  // Load initial data only once
  useEffect(() => {
    const initTransactionList = async () => {
      // Check if we already have data in global state
      if (transactionGlobalState.availableMonths.length > 0 && 
          Date.now() - transactionGlobalState.lastFetch < 30000) {
        setAvailableMonths(transactionGlobalState.availableMonths);
        if (transactionGlobalState.availableMonths.length > 0) {
          setSelectedMonth(transactionGlobalState.availableMonths[0]);
        }
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadingProgress(20);
        
        // Check cache first
        const cachedMonths = cache.get('available-months');
        if (cachedMonths) {
          setAvailableMonths(cachedMonths);
          transactionGlobalState.availableMonths = cachedMonths;
          if (cachedMonths.length > 0) {
            setSelectedMonth(cachedMonths[0]);
          }
          setLoadingProgress(40);
        } else {
          const months = await transactionAPI.getAvailableMonths();
          setAvailableMonths(months);
          transactionGlobalState.availableMonths = months;
          cache.set('available-months', months);
          if (months.length > 0) {
            setSelectedMonth(months[0]);
          }
          setLoadingProgress(40);
        }
        
        transactionGlobalState.lastFetch = Date.now();
        
      } catch (error) {
        console.error('Error loading months:', error);
        setIsLoading(false);
      }
    };

    initTransactionList();
  }, []);

  // Load all transactions with caching
  const loadAllTransactions = useCallback(async () => {
    try {
      setLoadingProgress(60);
      
      // Check cache first
      const cachedTransactions = cache.get('transactions-all');
      if (cachedTransactions) {
        transactionGlobalState.allTransactions = cachedTransactions;
        setLoadingProgress(80);
        return cachedTransactions;
      }
      
      const response = await transactionAPI.getTransactions();
      transactionGlobalState.allTransactions = response;
      cache.set('transactions-all', response);
      setLoadingProgress(80);
      
      return response;
    } catch (error) {
      console.error('Error loading all transactions:', error);
      return [];
    }
  }, []);

  // Optimized transaction loading with caching
  const loadTransactions = useCallback(async (month: string) => {
    try {
      setLoadingProgress(60);
      
      // Check cache first
      const cacheKey = `transactions-${month}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        setTransactions(cachedData);
        await calculateSummary(cachedData, month);
        setLoadingProgress(80);
        return cachedData;
      }
      
      const response = await transactionAPI.getTransactions(month);
      setTransactions(response);
      cache.set(cacheKey, response);
      await calculateSummary(response, month);
      setLoadingProgress(80);
      
      return response;
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }, []);

  // Optimized summary calculation with caching
  const calculateSummary = useCallback(async (transactions: Transaction[], month: string) => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate balance from all previous months
    let previousBalance = 0;
    try {
      // Use cached all transactions if available
      const allTransactions = transactionGlobalState.allTransactions.length > 0 
        ? transactionGlobalState.allTransactions 
        : await loadAllTransactions();
      
      const previousTransactions = allTransactions.filter((t: Transaction) => {
        const transactionMonth = t.date.substring(0, 7); // YYYY-MM format
        return transactionMonth < month;
      });
      
      previousBalance = previousTransactions.reduce((balance: number, t: Transaction) => {
        return t.type === 'income' ? balance + t.amount : balance - t.amount;
      }, 0);
    } catch (error) {
      console.error('Error calculating previous balance:', error);
    }
    
    setSummary({
      totalIncome: income,
      totalExpenses: expenses,
      balance: previousBalance + income - expenses,
      incomeCount: incomeTransactions.length,
      expenseCount: expenseTransactions.length
    });
    
    setLoadingProgress(100);
    
    // Small delay to show completion
    setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    }, 300);
  }, [loadAllTransactions]);

  // Load data for selected month
  useEffect(() => {
    if (selectedMonth) {
      const loadMonthData = async () => {
        setIsRefreshing(true);
        setLoadingProgress(0);
        
        await loadTransactions(selectedMonth);
      };
      
      loadMonthData();
    }
  }, [selectedMonth, loadTransactions]);

  // Handle transaction updates
  const handleTransactionUpdated = useCallback(async () => {
    // Clear cache for affected data
    cache.delete(`transactions-${selectedMonth}`);
    cache.delete('transactions-all');
    cache.delete('available-months');
    
    // Clear global state
    transactionGlobalState.allTransactions = [];
    transactionGlobalState.availableMonths = [];
    transactionGlobalState.lastFetch = 0;
    
    // Show refreshing overlay
    setIsRefreshing(true);
    setLoadingProgress(0);
    
    try {
      // Reload months first
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months);
      transactionGlobalState.availableMonths = months;
      cache.set('available-months', months);
      
      if (months.includes(selectedMonth)) {
        // Reload current month data
        await loadTransactions(selectedMonth);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setIsRefreshing(false);
    }
  }, [selectedMonth, loadTransactions]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    setLoading(true);
    setError('');

    try {
      await transactionAPI.deleteTransaction(transactionToDelete._id!);
      // Clear cache and reload
      cache.delete(`transactions-${selectedMonth}`);
      cache.delete('transactions-all');
      cache.delete('available-months');
      await handleTransactionUpdated();
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    } catch (error: any) {
      setError(error.response?.message || 'Failed to delete transaction');
      console.error('Error deleting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PKR', 'Rs');
  };

  // Loading Screen Component
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Loading Container */}
      <div className="relative z-10 bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 shadow-2xl max-w-2xl w-full">
        {/* Logo/Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
              <Wallet className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center animate-bounce">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center animate-bounce delay-300">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mt-6">Transaction History</h1>
          <p className="text-blue-300 mt-2">Loading your financial transactions</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-300 mb-2">
            <span>Loading transaction data...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Loading Steps */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 30 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-700/30'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 30 ? 'bg-blue-500/20' : 'bg-slate-600/50'}`}>
              <Calendar className={`w-5 h-5 ${loadingProgress >= 30 ? 'text-blue-400' : 'text-slate-400'}`} />
            </div>
            <p className={`text-sm font-medium ${loadingProgress >= 30 ? 'text-blue-300' : 'text-slate-400'}`}>
              {loadingProgress >= 30 ? '✓' : '...'} Loading Months
            </p>
          </div>

          <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 60 ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-slate-700/30'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 60 ? 'bg-indigo-500/20' : 'bg-slate-600/50'}`}>
              <TrendingUp className={`w-5 h-5 ${loadingProgress >= 60 ? 'text-indigo-400' : 'text-slate-400'}`} />
            </div>
            <p className={`text-sm font-medium ${loadingProgress >= 60 ? 'text-indigo-300' : 'text-slate-400'}`}>
              {loadingProgress >= 60 ? '✓' : '...'} Loading Transactions
            </p>
          </div>

          <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 90 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 90 ? 'bg-emerald-500/20' : 'bg-slate-600/50'}`}>
              <Wallet className={`w-5 h-5 ${loadingProgress >= 90 ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>
            <p className={`text-sm font-medium ${loadingProgress >= 90 ? 'text-emerald-300' : 'text-slate-400'}`}>
              {loadingProgress >= 90 ? '✓' : '...'} Calculating Summary
            </p>
          </div>
        </div>

        {/* Loading Messages */}
        <div className="text-center">
          <div className="inline-block bg-slate-700/50 rounded-full px-4 py-2 mb-4">
            <div className="flex items-center gap-2">
              <Loader className="w-4 h-4 text-blue-400 animate-spin" />
              <p className="text-slate-300 text-sm">
                {loadingProgress < 30 && "Preparing your transaction history..."}
                {loadingProgress >= 30 && loadingProgress < 60 && "Loading transaction data..."}
                {loadingProgress >= 60 && loadingProgress < 90 && "Calculating financial summary..."}
                {loadingProgress >= 90 && "Finalizing your transaction overview..."}
              </p>
            </div>
          </div>
          
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {loadingProgress < 50 
              ? "We're gathering your transaction history from all sources."
              : "Analyzing your income and expenses to provide detailed insights."
            }
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 rounded-full blur-2xl"></div>
        <div className="absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-r from-slate-500/20 to-gray-600/20 rounded-full blur-2xl"></div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-center">
        <p className="text-slate-500 text-sm">
          Please wait while we prepare your transaction history
        </p>
        <p className="text-slate-600 text-xs mt-1">
          This usually takes just a few moments...
        </p>
      </div>
    </div>
  );

  // Refreshing Overlay Component
  const RefreshingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 rounded-2xl p-8 border border-blue-500/30">
        <div className="flex flex-col items-center">
          <Loader className="w-12 h-12 text-blue-400 animate-spin mb-4" />
          <p className="text-white text-lg font-semibold">Updating data...</p>
          <p className="text-slate-400 text-sm mt-2">Please wait a moment</p>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      {isRefreshing && <RefreshingOverlay />}
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Balance Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Current Balance</p>
                <p className={`text-2xl font-bold mt-2 ${
                  summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatCurrency(summary.balance)}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {summary.incomeCount} income • {summary.expenseCount} expense
                </p>
              </div>
              <div className="p-3 bg-slate-700 rounded-xl">
                <Wallet className={`w-6 h-6 ${
                  summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Net Flow</span>
                <span className={summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Income Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Income</p>
                <p className="text-2xl font-bold text-emerald-400 mt-2">
                  {formatCurrency(summary.totalIncome)}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {summary.incomeCount} transactions
                </p>
              </div>
              <div className="p-3 bg-slate-700 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Avg. Income</span>
                <span className="text-emerald-400">
                  {summary.incomeCount > 0 ? formatCurrency(summary.totalIncome / summary.incomeCount) : 'Rs 0'}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-rose-400 mt-2">
                  {formatCurrency(summary.totalExpenses)}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {summary.expenseCount} transactions
                </p>
              </div>
              <div className="p-3 bg-slate-700 rounded-xl">
                <TrendingDown className="w-6 h-6 text-rose-400" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Avg. Expense</span>
                <span className="text-rose-400">
                  {summary.expenseCount > 0 ? formatCurrency(summary.totalExpenses / summary.expenseCount) : 'Rs 0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {summary.totalIncome > 0 && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Income vs Expenses</span>
              <span>{Math.round((summary.totalExpenses / summary.totalIncome) * 100)}% spent</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-rose-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${summary.totalIncome > 0 ? Math.min((summary.totalExpenses / summary.totalIncome) * 100, 100) : 0}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Rs 0</span>
              <span>{formatCurrency(summary.totalIncome)}</span>
            </div>
          </div>
        )}

        {/* Header and Controls */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Transaction History</h1>
              <p className="text-slate-400 mt-1">
                {selectedMonth ? `Viewing transactions for ${formatMonth(selectedMonth)}` : 'Manage and track your financial transactions'}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 ">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-700 border cursor-pointer border-slate-600 text-white rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableMonths.map(month => (
                  <option key={month} value={month} className="bg-slate-700">
                    {formatMonth(month)}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r cursor-pointer from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Create className="w-5 h-5" />
                Add Transaction
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3 rounded-xl mb-6">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-300">
                ×
              </button>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-6 text-slate-400 font-semibold text-sm">Sr#</th>
                  <th className="text-left py-4 px-6 text-slate-400 font-semibold text-sm">Date</th>
                  <th className="text-left py-4 px-6 text-slate-400 font-semibold text-sm">Name</th>
                  <th className="text-left py-4 px-6 text-slate-400 font-semibold text-sm">Type</th>
                  <th className="text-right py-4 px-6 text-slate-400 font-semibold text-sm">Amount</th>
                  <th className="text-center py-4 px-6 text-slate-400 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr 
                    key={transaction._id}
                    className={`border-b border-slate-700/50 hover:bg-slate-750 transition-colors duration-150 ${
                      index === transactions.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="py-4 px-6 text-slate-300">{index+1}</td>
                    <td className="py-4 px-6 text-slate-300">{formatDate(transaction.date)}</td>
                    <td className="py-4 px-6">
                      <div className="text-slate-300 font-medium">{transaction.name}</div>
                      {transaction.description && (
                        <div className="text-slate-500 text-sm mt-1">{transaction.description}</div>
                      )}
                    </td>
                    
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'income' 
                          ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-900/50 text-rose-400 border border-rose-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={`font-bold ${
                        transaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-2 text-blue-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                          title="Edit transaction"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(transaction)}
                          className="p-2 text-rose-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                          title="Delete transaction"
                        >
                          <Delete className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-slate-500">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">No transactions found</p>
                        <p className="text-sm mt-1">
                          {selectedMonth ? `for ${formatMonth(selectedMonth)}` : 'Start by adding your first transaction'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Form */}
        <TransactionForm
          open={showForm}
          onClose={handleFormClose}
          editingTransaction={editingTransaction}
          onTransactionUpdated={handleTransactionUpdated}
        />

        {/* Delete Confirmation Modal */}
        {deleteDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white">Delete Transaction</h3>
                <p className="text-slate-400 mt-1">This action cannot be undone.</p>
              </div>
              
              <div className="p-6">
                {transactionToDelete && (
                  <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-400">Date:</span>
                        <p className="text-white">{formatDate(transactionToDelete.date)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Amount:</span>
                        <p className={`font-semibold ${
                          transactionToDelete.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {formatCurrency(transactionToDelete.amount)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Name:</span>
                        <p className="text-white">{transactionToDelete.name}</p>
                        {transactionToDelete.description && (
                          <p className="text-slate-400 text-sm mt-1">{transactionToDelete.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={loading}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl hover:from-rose-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 font-semibold"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TransactionList;