import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { transactionAPI } from '../services/api';
import { Transaction, MonthlySummary } from '../types';
import TransactionForm from './Transactions';
import { Calendar, Loader, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import cache from '../services/cache';
import sessionManager from '../services/sessionManager';

const Dashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasData, setHasData] = useState<boolean>(false);

  // Initialize user session
  useEffect(() => {
    const userId = sessionManager.getCurrentUser();
    if (!userId) {
      window.location.href = '/login';
      return;
    }

    const storedUserId = localStorage.getItem('userId');
    if (storedUserId && storedUserId !== userId) {
      cache.clearCurrentUserCache();
    }

    cache.setUserId(userId);
    localStorage.setItem('userId', userId);
  }, []);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress(10);

    try {
      const months = await transactionAPI.getAvailableMonths();
      setLoadingProgress(40);

      if (months.length === 0) {
        setHasData(false);
        setAvailableMonths([]);
        cache.set('available-months', []);
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      setHasData(true);
      setAvailableMonths(months);
      cache.set('available-months', months);

      const sortedMonths = [...months].sort();
      setSelectedMonth(sortedMonths[sortedMonths.length - 1]);
      setLoadingProgress(60);

    } catch (error) {
      console.error('Error loading initial data:', error);
      setHasData(false);
      setAvailableMonths([]);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load transactions for selected month
  const loadTransactions = useCallback(async (month: string) => {
    const cacheKey = `transactions-${month}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      setTransactions(cachedData);
      return cachedData;
    }

    const response = await transactionAPI.getTransactions(month);
    setTransactions(response);
    if (response?.length > 0) cache.set(cacheKey, response);
    return response;
  }, []);

  // Load monthly summary
  const loadMonthlySummary = useCallback(async (month: string) => {
    const cacheKey = `summary-${month}`;
    const cachedSummary = cache.get(cacheKey);

    if (cachedSummary) return cachedSummary;

    const response = await transactionAPI.getMonthlySummary(month);
    if (response) cache.set(cacheKey, response);
    return response;
  }, []);

  // Calculate opening balance
  const calculateOpeningBalance = useCallback(async (month: string, months: string[]) => {
    if (!month || months.length === 0) {
      setOpeningBalance(0);
      setIsLoading(false);
      setIsRefreshing(false);
      return 0;
    }

    const sortedMonths = [...months].sort();
    const currentIndex = sortedMonths.indexOf(month);

    if (currentIndex === 0) {
      setOpeningBalance(0);
      setLoadingProgress(100);
      setIsLoading(false);
      setIsRefreshing(false);
      return 0;
    }

    let cumulativeBalance = 0;
    for (let i = 0; i < currentIndex; i++) {
      const summary = await loadMonthlySummary(sortedMonths[i]);
      if (summary) {
        cumulativeBalance += summary.totalIncome - summary.totalExpenses;
      }
    }

    setOpeningBalance(cumulativeBalance);
    setLoadingProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    }, 300);

    return cumulativeBalance;
  }, [loadMonthlySummary]);

  // Load month data
  useEffect(() => {
    if (selectedMonth && hasData) {
      const loadMonthData = async () => {
        setIsRefreshing(true);
        setLoadingProgress(70);

        await Promise.all([
          loadTransactions(selectedMonth),
          loadMonthlySummary(selectedMonth)
        ]);

        await calculateOpeningBalance(selectedMonth, availableMonths);
      };

      loadMonthData();
    }
  }, [selectedMonth, hasData, availableMonths, loadTransactions, loadMonthlySummary, calculateOpeningBalance]);

  // Handle transaction updates
  const handleTransactionUpdated = useCallback(async () => {
    if (!selectedMonth) return;

    cache.delete(`transactions-${selectedMonth}`);
    cache.delete(`summary-${selectedMonth}`);
    cache.delete('available-months');

    setIsRefreshing(true);
    setLoadingProgress(0);

    try {
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months);

      if (months.length === 0) {
        setHasData(false);
        setTransactions([]);
        setOpeningBalance(0);
      } else {
        setHasData(true);
        if (months.includes(selectedMonth)) {
          await Promise.all([
            loadTransactions(selectedMonth),
            loadMonthlySummary(selectedMonth)
          ]);
          await calculateOpeningBalance(selectedMonth, months);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setIsRefreshing(false);
    }
  }, [selectedMonth, loadTransactions, loadMonthlySummary, calculateOpeningBalance]);

  // Handle "Add First Transaction" button
  const handleAddFirstTransaction = () => {
    setShowForm(true);
  };

  // Memoized calculations
  const { sortedTransactions, incomeTransactions, expenseTransactions, totalIncome, totalExpenses, currentBalance } = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const income = sorted.filter(t => t.type === 'income');
    const expenses = sorted.filter(t => t.type === 'expense');
    const totalInc = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExp = expenses.reduce((sum, t) => sum + t.amount, 0);
    const balance = openingBalance + totalInc - totalExp;

    return {
      sortedTransactions: sorted,
      incomeTransactions: income,
      expenseTransactions: expenses,
      totalIncome: totalInc,
      totalExpenses: totalExp,
      currentBalance: balance
    };
  }, [transactions, openingBalance]);

  // Utility functions
  const formatMonth = useCallback((monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    });
  }, []);

  // Download Excel Report
  const downloadExcel = async () => {
    try {
      const allTransactions = await transactionAPI.getTransactions();
      
      if (!allTransactions?.length) {
        alert('No transactions to export');
        return;
      }

      const transactionsByMonth: Record<string, Transaction[]> = {};
      allTransactions.forEach((transaction: Transaction) => {
        const monthYear = transaction.date.substring(0, 7);
        if (!transactionsByMonth[monthYear]) {
          transactionsByMonth[monthYear] = [];
        }
        transactionsByMonth[monthYear].push(transaction);
      });

      const sortedMonths = Object.keys(transactionsByMonth).sort();
      const workbook = { SheetNames: [] as string[], Sheets: {} as any };
      let cumulativeBalance = 0;

      sortedMonths.forEach((month) => {
        const monthTransactions = transactionsByMonth[month];
        const sheetName = formatMonth(month).substring(0, 31);
        workbook.SheetNames.push(sheetName);

        const income = monthTransactions.filter(t => t.type === 'income');
        const expenses = monthTransactions.filter(t => t.type === 'expense');
        const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
        const monthlyBalance = totalIncome - totalExpenses;

        const sheetData: (string | number)[][] = [
          [`${formatMonth(month)} - Financial Transactions`, '', '', ''],
          ['Generated on:', new Date().toLocaleDateString(), '', ''],
          [],
          ['Opening Balance:', '', '', cumulativeBalance],
          [],
          ['INCOME TRANSACTIONS', '', 'EXPENSE TRANSACTIONS', ''],
          ['Date', 'Title', 'Amount (PKR)', 'Date', 'Title', 'Description', 'Amount (PKR)'],
          []
        ];

        const maxRows = Math.max(income.length, expenses.length);
        for (let i = 0; i < maxRows; i++) {
          const incomeRow = income[i];
          const expenseRow = expenses[i];
          sheetData.push([
            incomeRow ? formatDate(incomeRow.date) : '',
            incomeRow ? incomeRow.name : '',
            incomeRow ? incomeRow.amount : '',
            expenseRow ? formatDate(expenseRow.date) : '',
            expenseRow ? expenseRow.name + (expenseRow.description ? ` - ${expenseRow.description}` : '') : '',
            expenseRow ? expenseRow.description : '',
            expenseRow ? expenseRow.amount : ''
          ]);
        }

        sheetData.push(
          [],
          ['INCOME SUMMARY', '', 'EXPENSE SUMMARY', ''],
          ['Total Income:', totalIncome, 'Total Expenses:', totalExpenses],
          ['Number of Transactions:', income.length, 'Number of Transactions:', expenses.length],
          ['Average Income:', income.length > 0 ? (totalIncome / income.length).toFixed(2) : 0, 
           'Average Expense:', expenses.length > 0 ? (totalExpenses / expenses.length).toFixed(2) : 0],
          [],
          ['MONTHLY NET BALANCE', '', '', ''],
          ['Opening Balance:', '', '', cumulativeBalance],
          ['+ Total Income:', '', '', totalIncome],
          ['- Total Expenses:', '', '', totalExpenses],
          ['= Closing Balance:', '', '', cumulativeBalance + monthlyBalance],
          []
        );

        cumulativeBalance += monthlyBalance;
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        worksheet['!cols'] = [
          { wch: 15 }, { wch: 30 }, { wch: 15 },
          { wch: 30 }, { wch: 15 }, { wch: 15 }
        ];
        workbook.Sheets[sheetName] = worksheet;
      });

      XLSX.writeFile(workbook, `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading transactions file');
    }
  };

  // Loading component
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="relative z-10 bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 shadow-2xl max-w-2xl w-full">
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center animate-pulse">
              <Wallet className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mt-6">BudgetTracker</h1>
          <p className="text-cyan-300 mt-2">Loading your financial dashboard</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-300 mb-2">
            <span>Loading financial data...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
  // Refreshing overlay
  const RefreshingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 rounded-2xl p-8 border border-cyan-500/30">
        <div className="flex flex-col items-center">
          <Loader className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
          <p className="text-white text-lg font-semibold">Updating data...</p>
        </div>
      </div>
    </div>
  );

  // Main table component
  const TransactionTable = ({ 
    title, 
    transactions, 
    total, 
    color = 'emerald',
    icon = '💰',
    isIncome = true 
  }: {
    title: string;
    transactions: Transaction[];
    total: number;
    color?: 'emerald' | 'rose';
    icon?: string;
    isIncome?: boolean;
  }) => {
    const colorClasses = {
      emerald: {
        bg: 'from-emerald-600 to-green-600',
        accent: 'emerald',
        text: 'text-emerald-300'
      },
      rose: {
        bg: 'from-rose-600 to-red-600',
        accent: 'rose',
        text: 'text-rose-300'
      }
    };

    const currentColor = colorClasses[color];

    return (
      <div className="bg-gradient-to-br from-slate-800/80 to-blue-900/80 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        <div className={`bg-gradient-to-r ${currentColor.bg} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <span className="mr-3">{icon}</span>
              {title}
            </h2>
            <div className={`bg-${currentColor.accent}-500/20 px-4 py-2 rounded-full border border-${currentColor.accent}-400/30`}>
              <span className={`font-semibold text-${currentColor.accent}-100`}>
                Rs {total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`bg-${currentColor.accent}-900/30 border-b border-${currentColor.accent}-800/30`}>
                <th className={`text-left py-4 px-6 ${currentColor.text} font-semibold`}>Sr#</th>
                <th className={`text-left py-4 px-6 ${currentColor.text} font-semibold`}>Date</th>
                <th className={`text-left py-4 px-6 ${currentColor.text} font-semibold`}>Description</th>
                <th className={`text-right py-4 px-6 ${currentColor.text} font-semibold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr key={transaction._id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                  <td className="py-4 px-6 text-slate-200 font-medium">{index + 1}</td>
                  <td className="py-4 px-6 text-slate-200 font-medium">{formatDate(transaction.date)}</td>
                  <td className="py-4 px-6">
                    <div>
                      <div className="text-white font-semibold">{transaction.name}</div>
                      <div className="text-slate-400 text-sm mt-1">{transaction.category}</div>
                    </div>
                  </td>
                  <td className={`py-4 px-6 text-right font-bold ${currentColor.text}`}>
                    {isIncome ? '+' : '-'}Rs {transaction.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400">
                    No {title.toLowerCase()} for {selectedMonth ? formatMonth(selectedMonth) : 'this month'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Balance card component
  const BalanceCard = ({ 
    title, 
    amount, 
    description = '', 
    color = 'cyan',
    showSign = false 
  }: {
    title: string;
    amount: number;
    description?: string;
    color?: 'cyan' | 'emerald' | 'rose';
    showSign?: boolean;
  }) => {
    const colorClasses = {
      cyan: 'from-blue-900/40 to-cyan-900/40 border-cyan-700/30 text-cyan-300',
      emerald: 'from-emerald-900/40 to-green-900/40 border-emerald-700/30 text-emerald-300',
      rose: 'from-rose-900/40 to-red-900/40 border-rose-700/30 text-rose-300'
    };

    const sign = showSign ? (amount >= 0 ? '+' : '-') : '';
    const displayAmount = Math.abs(amount);

    return (
      <div className="text-center group">
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 border transition-all duration-300 group-hover:scale-105`}>
          <div className={`font-semibold text-lg mb-3`}>{title}</div>
          <div className="text-white font-bold text-3xl mb-2">
            {sign}Rs {displayAmount.toLocaleString()}
          </div>
          {description && <div className={`text-${color}-400/70 text-sm`}>{description}</div>}
        </div>
      </div>
    );
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      {isRefreshing && <RefreshingOverlay />}
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="hidden lg:flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Financial Dashboard</h1>
              <p className="text-blue-200 text-lg">Track your income and expenses</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={downloadExcel}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2 cursor-pointer"
              >
                Download Excel
              </button>
              <button 
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-8 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer"
              >
                + Add Transaction
              </button>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="mb-8 bg-gradient-to-br from-slate-800/60 to-blue-900/40 backdrop-blur-xl rounded-3xl p-8 border border-cyan-500/20 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-400/20">
                <Calendar className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <label className="block text-cyan-100 font-bold text-lg">Select Month</label>
                <p className="text-cyan-300/70 text-sm">Choose a period to view transactions</p>
              </div>
            </div>
          </div>
          
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-gradient-to-r from-slate-800/80 to-blue-900/60 border-2 border-cyan-500/30 rounded-2xl px-6 py-4 text-white text-lg font-medium focus:outline-none focus:ring-4 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all duration-300 hover:border-cyan-400/50 cursor-pointer"
          >
            {availableMonths.map(month => (
              <option key={month} value={month} className="bg-slate-800 text-white py-2">
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </div>

        {/* Balance Summary */}
        <div className="mb-8 bg-gradient-to-br from-slate-800/80 via-blue-900/80 to-indigo-900/80 rounded-3xl shadow-2xl border border-slate-700/50 p-8 backdrop-blur-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <BalanceCard 
              title="Opening Balance" 
              amount={openingBalance} 
              description="Previous Month Balance" 
              color="cyan" 
            />
            <BalanceCard 
              title="Income" 
              amount={totalIncome} 
              color="emerald" 
              showSign={true}
            />
            <BalanceCard 
              title="Expenses" 
              amount={totalExpenses} 
              color="rose" 
              showSign={true}
            />
            <BalanceCard 
              title="Current Balance" 
              amount={currentBalance} 
              color={currentBalance >= 0 ? 'emerald' : 'rose'} 
              showSign={true}
            />
          </div>
        </div>

        {/* Transaction Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TransactionTable 
            title="Income Transactions"
            transactions={incomeTransactions}
            total={totalIncome}
            color="emerald"
            icon="💰"
            isIncome={true}
          />
          <TransactionTable 
            title="Expense Transactions"
            transactions={expenseTransactions}
            total={totalExpenses}
            color="rose"
            icon="💸"
            isIncome={false}
          />
        </div>

        <TransactionForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onTransactionUpdated={handleTransactionUpdated}
        />
      </div>
    </>
  );
};

export default Dashboard;