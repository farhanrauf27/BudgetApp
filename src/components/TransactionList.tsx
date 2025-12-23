import React, { useState, useEffect,useCallback } from 'react';
import { Delete, Edit, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { transactionAPI } from '../services/api';
import { Transaction } from '../types';
import TransactionForm from './Transactions';
import { Create } from '@mui/icons-material';

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
  

  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    incomeCount: 0,
    expenseCount: 0
  });
  useEffect(() => {
  loadAvailableMonths();
  
}, []);

  

  const loadAvailableMonths = async () => {
    try {
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months.data);
      if (months.data.length > 0) {
        setSelectedMonth(months.data[0]);
      }
    } catch (error) {
      console.error('Error loading months:', error);
    }
  };

  const calculateSummary = useCallback(async (transactions: Transaction[]) => {
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  
  const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate balance from all previous months
  let previousBalance = 0;
  try {
    const allTransactions = await transactionAPI.getTransactions();
    const currentMonthYear = selectedMonth;
    const previousTransactions = allTransactions.data.filter((t: Transaction) => {
      const transactionMonth = t.date.substring(0, 7); // YYYY-MM format
      return transactionMonth < currentMonthYear;
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
    balance: previousBalance + income - expenses, // Previous balance + current month net
    incomeCount: incomeTransactions.length,
    expenseCount: expenseTransactions.length
  });
}, [selectedMonth]);

  const loadTransactions = useCallback(async () => {
    try {
      const response = await transactionAPI.getTransactions(selectedMonth);
      setTransactions(response.data);
     await calculateSummary(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, [selectedMonth,calculateSummary]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  

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
      await loadTransactions();
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete transaction');
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

  return (
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
        onTransactionUpdated={() => {
          loadTransactions();
          loadAvailableMonths();
        }}
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
  );
};

export default TransactionList;