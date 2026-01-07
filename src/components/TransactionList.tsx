import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Delete, Edit, TrendingUp, TrendingDown, Wallet, Loader, Calendar } from 'lucide-react';
import { transactionAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionForm from './Transactions';
import { Create } from '@mui/icons-material';
import cache from '../services/cache';

const TransactionList: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
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

  // Helper functions
  const formatMonth = useCallback((monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return `Rs ${amount.toLocaleString()}`;
  }, []);

  // Load initial data
  useEffect(() => {
    const initTransactionList = async () => {
      try {
        setIsLoading(true);
        setLoadingProgress(20);
        
        const cachedMonths = cache.get('available-months');
        if (cachedMonths) {
          setAvailableMonths(cachedMonths);
          if (cachedMonths.length > 0) {
            setSelectedMonth(cachedMonths[0]);
          }
          setLoadingProgress(40);
        } else {
          const months = await transactionAPI.getAvailableMonths();
          setAvailableMonths(months);
          cache.set('available-months', months);
          if (months.length > 0) {
            setSelectedMonth(months[0]);
          }
          setLoadingProgress(40);
        }
        
      } catch (error) {
        console.error('Error loading months:', error);
        setIsLoading(false);
      }
    };

    initTransactionList();
  }, []);

  // Load all transactions
  const loadAllTransactions = useCallback(async () => {
    const cachedTransactions = cache.get('transactions-all');
    if (cachedTransactions) return cachedTransactions;
    
    const response = await transactionAPI.getTransactions();
    cache.set('transactions-all', response);
    return response;
  }, []);

  // Load transactions for selected month
  const loadTransactions = useCallback(async (month: string) => {
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
  }, []);

  // Calculate summary
  const calculateSummary = useCallback(async (transactions: Transaction[], month: string) => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    let previousBalance = 0;
    try {
      const allTransactions = await loadAllTransactions();
      const previousTransactions = allTransactions.filter((t: Transaction) => {
        const transactionMonth = t.date.substring(0, 7);
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
    cache.delete(`transactions-${selectedMonth}`);
    cache.delete('transactions-all');
    cache.delete('available-months');
    
    setIsRefreshing(true);
    setLoadingProgress(0);
    
    try {
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months);
      cache.set('available-months', months);
      
      if (months.includes(selectedMonth)) {
        await loadTransactions(selectedMonth);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setIsRefreshing(false);
    }
  }, [selectedMonth, loadTransactions]);

  // Transaction actions
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
      cache.delete(`transactions-${selectedMonth}`);
      cache.delete('transactions-all');
      cache.delete('available-months');
      await handleTransactionUpdated();
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    } catch (error: any) {
      setError(error.response?.message || 'Failed to delete transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  // Memoized calculations
  const spentPercentage = useMemo(() => 
    summary.totalIncome > 0 ? Math.round((summary.totalExpenses / summary.totalIncome) * 100) : 0, 
    [summary.totalIncome, summary.totalExpenses]
  );

  const avgIncome = useMemo(() => 
    summary.incomeCount > 0 ? summary.totalIncome / summary.incomeCount : 0, 
    [summary.totalIncome, summary.incomeCount]
  );

  const avgExpense = useMemo(() => 
    summary.expenseCount > 0 ? summary.totalExpenses / summary.expenseCount : 0, 
    [summary.totalExpenses, summary.expenseCount]
  );

  // Components
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="relative z-10 bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 shadow-2xl max-w-2xl w-full">
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mt-6">Transaction History</h1>
          <p className="text-blue-300 mt-2">Loading your financial transactions</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-300 mb-2">
            <span>Loading transaction data...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const RefreshingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 rounded-2xl p-8 border border-blue-500/30">
        <div className="flex flex-col items-center">
          <Loader className="w-12 h-12 text-blue-400 animate-spin mb-4" />
          <p className="text-white text-lg font-semibold">Updating data...</p>
        </div>
      </div>
    </div>
  );

  const SummaryCard = ({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    color = 'blue',
    isBalance = false 
  }: {
    title: string;
    value: string;
    subValue: string;
    icon: React.ElementType;
    color?: 'blue' | 'emerald' | 'rose';
    isBalance?: boolean;
  }) => {
    const colorClasses = {
      blue: { text: 'text-blue-400', bg: 'bg-slate-700' },
      emerald: { text: 'text-emerald-400', bg: 'bg-slate-700' },
      rose: { text: 'text-rose-400', bg: 'bg-slate-700' }
    };

    return (
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-2 ${colorClasses[color].text}`}>
              {value}
            </p>
            <p className="text-slate-500 text-xs mt-1">{subValue}</p>
          </div>
          <div className={`p-3 ${colorClasses[color].bg} rounded-xl`}>
            <Icon className={`w-6 h-6 ${colorClasses[color].text}`} />
          </div>
        </div>
        {isBalance && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Net Flow</span>
              <span className={summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TransactionRow = ({ transaction, index }: { transaction: Transaction; index: number }) => {
    const isIncome = transaction.type === 'income';
    
    return (
      <tr className="border-b border-slate-700/50 hover:bg-slate-750 transition-colors duration-150">
        <td className="py-4 px-6 text-slate-300">{index + 1}</td>
        <td className="py-4 px-6 text-slate-300">{formatDate(transaction.date)}</td>
        <td className="py-4 px-6">
          <div className="text-slate-300 font-medium">{transaction.name}</div>
          {transaction.description && (
            <div className="text-slate-500 text-sm mt-1">{transaction.description}</div>
          )}
        </td>
        <td className="py-4 px-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            isIncome 
              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
              : 'bg-rose-900/50 text-rose-400 border border-rose-800'
          }`}>
            {transaction.type}
          </span>
        </td>
        <td className="py-4 px-6 text-right">
          <span className={`font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </span>
        </td>
        <td className="py-4 px-6">
          <div className="flex justify-center gap-2">
            <button onClick={() => handleEdit(transaction)} className="p-2 text-blue-400 hover:bg-slate-700 rounded-xl cursor-pointer">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => handleDeleteClick(transaction)} className="p-2 text-rose-400 hover:bg-slate-700 rounded-xl cursor-pointer">
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      {isRefreshing && <RefreshingOverlay />}
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SummaryCard
            title="Current Balance"
            value={formatCurrency(summary.balance)}
            subValue={`${summary.incomeCount} income • ${summary.expenseCount} expense`}
            icon={Wallet}
            color={summary.balance >= 0 ? 'emerald' : 'rose'}
            isBalance={true}
          />
          
          <SummaryCard
            title="Total Income"
            value={formatCurrency(summary.totalIncome)}
            subValue={`${summary.incomeCount} transactions`}
            icon={TrendingUp}
            color="emerald"
          />
          
          <SummaryCard
            title="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            subValue={`${summary.expenseCount} transactions`}
            icon={TrendingDown}
            color="rose"
          />
        </div>

        {/* Progress Bar */}
        {summary.totalIncome > 0 && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Income vs Expenses</span>
              <span>{spentPercentage}% spent</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-rose-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(spentPercentage, 100)}%` }}
              />
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
            
            <div className="flex flex-col sm:flex-row gap-3">
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
                  <TransactionRow key={transaction._id} transaction={transaction} index={index} />
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