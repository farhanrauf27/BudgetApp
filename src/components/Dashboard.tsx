import React, { useState, useEffect, useCallback } from 'react';
import { transactionAPI } from '../services/api';
import { Transaction, MonthlySummary } from '../types';
import TransactionForm from './Transactions';
import { Calendar, Loader, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import cache from '../services/cache';
import sessionManager from '../services/sessionManager';

// REMOVE globalState - it causes user data leakage
const Dashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [, setSummary] = useState<MonthlySummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [hasData, setHasData] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Initialize user session and clear any previous cache
  useEffect(() => {
    const userId = sessionManager.getCurrentUser();
    if (!userId) {
      // No user session - redirect to login
      console.warn('No user session found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    // Check if user changed
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId && storedUserId !== userId) {
      console.log(`User changed from ${storedUserId} to ${userId}, clearing cache`);
      cache.clearCurrentUserCache();
    }

    // Set user ID for cache isolation
    setCurrentUserId(userId);
    cache.setUserId(userId);
    localStorage.setItem('userId', userId);
    
    console.log(`Dashboard initialized for user: ${userId}`);
  }, []);

  // Load initial data with user isolation
  useEffect(() => {
    const initDashboard = async () => {
      // Safety check - ensure we have a user
      if (!currentUserId) {
        console.log('Dashboard: Waiting for user identification...');
        return;
      }

      try {
        setIsLoading(true);
        setLoadingProgress(10);
        setError('');
        
        // Always fetch months from API - don't trust cache for initial load
        console.log(`Fetching months for user ${currentUserId}`);
        const months = await transactionAPI.getAvailableMonths();
        
        setLoadingProgress(40);
        
        if (months.length === 0) {
          // New user or no data
          console.log('No data found for this user - showing empty state');
          setHasData(false);
          setAvailableMonths([]);
          setTransactions([]);
          setOpeningBalance(0);
          setSummary(null);
          setLoadingProgress(100);
          
          // Cache the empty state
          cache.set('available-months', []);
          
          // Short delay to show completion
          setTimeout(() => {
            setIsLoading(false);
          }, 500);
          return;
        }
        
        // User has data
        setHasData(true);
        setAvailableMonths(months);
        
        // Cache the months
        cache.set('available-months', months);
        
        // Set to most recent month by default
        const sortedMonths = [...months].sort();
        const mostRecentMonth = sortedMonths[sortedMonths.length - 1];
        setSelectedMonth(mostRecentMonth);
        
        setLoadingProgress(60);
        
      } catch (error: any) {
        console.error('Error loading initial data:', error);
        setError(error.message || 'Failed to load data');
        
        // Set empty state on error
        setHasData(false);
        setAvailableMonths([]);
        setTransactions([]);
        setOpeningBalance(0);
        setIsLoading(false);
      }
    };

    initDashboard();
  }, [currentUserId]);

  // Optimized transaction loading
  const loadTransactions = useCallback(async (month: string) => {
    try {
      if (!currentUserId) {
        console.warn('No user ID for transaction loading');
        return [];
      }

      setLoadingProgress(prev => Math.min(prev + 10, 70));
      
      const cacheKey = month ? `transactions-${month}` : 'transactions-all';
      
      // Try cache first
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        setTransactions(cachedData);
        return cachedData;
      }
      
      // Fetch from API
      const response = await transactionAPI.getTransactions(month);
      setTransactions(response);
      
      // Cache only if we have data
      if (response && response.length > 0) {
        cache.set(cacheKey, response);
      }
      
      return response;
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }, [currentUserId]);

  // Optimized summary loading
  const loadMonthlySummary = useCallback(async (month: string) => {
    try {
      if (!currentUserId) return null;

      const cacheKey = `summary-${month}`;
      const cachedSummary = cache.get(cacheKey);
      
      if (cachedSummary) {
        setSummary(cachedSummary);
        return cachedSummary;
      }
      
      const response = await transactionAPI.getMonthlySummary(month);
      setSummary(response);
      
      // Cache only if we have data
      if (response) {
        cache.set(cacheKey, response);
      }
      
      return response;
    } catch (error) {
      console.error('Error loading summary:', error);
      return null;
    }
  }, [currentUserId]);

  // Optimized opening balance calculation
  const calculateOpeningBalance = useCallback(async (month: string, months: string[]) => {
    try {
      if (!currentUserId || !month || months.length === 0) {
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
      
      // Calculate from previous months
      for (let i = 0; i < currentIndex; i++) {
        const prevMonth = sortedMonths[i];
        const summary = await loadMonthlySummary(prevMonth);
        if (summary) {
          cumulativeBalance = cumulativeBalance + summary.totalIncome - summary.totalExpenses;
        }
      }
      
      setOpeningBalance(cumulativeBalance);
      setLoadingProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      }, 300);
      
      return cumulativeBalance;
    } catch (error) {
      console.error('Error calculating opening balance:', error);
      setOpeningBalance(0);
      setIsLoading(false);
      setIsRefreshing(false);
      return 0;
    }
  }, [currentUserId, loadMonthlySummary]);

  // Load data for selected month
  useEffect(() => {
    if (selectedMonth && currentUserId) {
      const loadMonthData = async () => {
        setIsRefreshing(true);
        setLoadingProgress(70);
        
        // Load in parallel
        await Promise.all([
          loadTransactions(selectedMonth),
          loadMonthlySummary(selectedMonth)
        ]);
        
        await calculateOpeningBalance(selectedMonth, availableMonths);
      };
      
      loadMonthData();
    }
  }, [selectedMonth, availableMonths, currentUserId, loadTransactions, loadMonthlySummary, calculateOpeningBalance]);

  // Handle transaction updates
  const handleTransactionUpdated = useCallback(async () => {
    if (!selectedMonth || !currentUserId) return;
    
    // Clear cache for affected data for current user only
    cache.delete(`transactions-${selectedMonth}`);
    cache.delete(`summary-${selectedMonth}`);
    cache.delete('available-months');
    cache.delete('transactions-all');
    
    // Show refreshing overlay
    setIsRefreshing(true);
    setLoadingProgress(0);
    
    try {
      // Reload months first
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months);
      
      if (months.length === 0) {
        setHasData(false);
        setTransactions([]);
        setOpeningBalance(0);
      } else {
        setHasData(true);
        if (months.includes(selectedMonth)) {
          // Reload current month data
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
  }, [selectedMonth, currentUserId, loadTransactions, loadMonthlySummary, calculateOpeningBalance]);

  

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('Loading timeout - setting empty state');
        setIsLoading(false);
        setHasData(false);
        setAvailableMonths([]);
        setTransactions([]);
        setOpeningBalance(0);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  // Utility functions
  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Sort transactions by date (ascending)
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const incomeTransactions = sortedTransactions.filter(t => t.type === 'income');
  const expenseTransactions = sortedTransactions.filter(t => t.type === 'expense');

  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = openingBalance + totalIncome - totalExpenses;

  // Download Excel Report
  const downloadExcel = async () => {
    try {
      // Get all transactions for all months
      const allTransactions = await transactionAPI.getTransactions();
      
      if (!allTransactions || allTransactions.length === 0) {
        alert('No transactions to export');
        return;
      }
      
      // Group transactions by month
      const transactionsByMonth: { [key: string]: Transaction[] } = {};
      
      allTransactions.forEach((transaction: Transaction) => {
        const monthYear = transaction.date.substring(0, 7); // YYYY-MM format
        if (!transactionsByMonth[monthYear]) {
          transactionsByMonth[monthYear] = [];
        }
        transactionsByMonth[monthYear].push(transaction);
      });

      // Create Excel workbook with multiple sheets
      const workbook = {
        SheetNames: [] as string[],
        Sheets: {} as any
      };

      // Sort months chronologically
      const sortedMonths = Object.keys(transactionsByMonth).sort();
      
      // Track cumulative balance for opening balances
      let cumulativeBalance = 0;
      
      sortedMonths.forEach((month) => {
        const monthTransactions = transactionsByMonth[month];
        const sheetName = formatMonth(month).substring(0, 31); // Excel sheet name limit
        workbook.SheetNames.push(sheetName);
        
        // Separate income and expense transactions
        const incomeTransactions = monthTransactions.filter(t => t.type === 'income');
        const expenseTransactions = monthTransactions.filter(t => t.type === 'expense');
        
        // Calculate totals
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
        const monthlyBalance = totalIncome - totalExpenses;
        
        // Prepare data for the sheet
        const sheetData: (string | number)[][] = [];
        
        // Header Section
        sheetData.push([`${formatMonth(month)} - Financial Transactions`, '', '', '']);
        sheetData.push(['Generated on:', new Date().toLocaleDateString(), '', '']);
        sheetData.push([]);
        
        // Opening Balance
        sheetData.push(['Opening Balance:', '', '', cumulativeBalance]);
        sheetData.push([]);
        
        // Column Headers
        sheetData.push(['INCOME TRANSACTIONS', '', 'EXPENSE TRANSACTIONS', '']);
        sheetData.push(['Date', 'Title','Amount (PKR)', 'Date', 'Title','Description','Amount (PKR)']);
        sheetData.push([]);
        
        // Find max rows between income and expenses
        const maxRows = Math.max(incomeTransactions.length, expenseTransactions.length);
        
        // Add transaction rows
        for (let i = 0; i < maxRows; i++) {
          const incomeRow = incomeTransactions[i];
          const expenseRow = expenseTransactions[i];
          
          const rowData = [
            incomeRow ? formatDate(incomeRow.date) : '',
            incomeRow ? incomeRow.name : '',
            incomeRow ? incomeRow.amount : '',
            expenseRow ? formatDate(expenseRow.date) : '',
            expenseRow ? expenseRow.name + (expenseRow.description ? ` - ${expenseRow.description}` : '') : '',
            expenseRow ? expenseRow.description : '',
            expenseRow ? expenseRow.amount : ''
          ];
          sheetData.push(rowData);
        }
        
        // Add summary rows
        sheetData.push([]);
        sheetData.push(['INCOME SUMMARY', '', 'EXPENSE SUMMARY', '']);
        sheetData.push(['Total Income:', totalIncome, 'Total Expenses:', totalExpenses]);
        sheetData.push(['Number of Transactions:', incomeTransactions.length, 'Number of Transactions:', expenseTransactions.length]);
        sheetData.push(['Average Income:', incomeTransactions.length > 0 ? (totalIncome / incomeTransactions.length).toFixed(2) : 0, 
                        'Average Expense:', expenseTransactions.length > 0 ? (totalExpenses / expenseTransactions.length).toFixed(2) : 0]);
        sheetData.push([]);
        
        // Net Balance Section
        sheetData.push(['MONTHLY NET BALANCE', '', '', '']);
        sheetData.push(['Opening Balance:', '', '', cumulativeBalance]);
        sheetData.push(['+ Total Income:', '', '', totalIncome]);
        sheetData.push(['- Total Expenses:', '', '', totalExpenses]);
        sheetData.push(['= Closing Balance:', '', '', cumulativeBalance + monthlyBalance]);
        sheetData.push([]);
        
        // Update cumulative balance for next month
        cumulativeBalance += monthlyBalance;
        
        // Convert sheet data to worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Set column widths
        const colWidths = [
          { wch: 15 }, // Date column
          { wch: 30 }, // Description column  
          { wch: 15 }, // Date column
          { wch: 30 }, // Description column
          { wch: 15 }, // Amount column
          { wch: 15 }  // Amount column
        ];
        worksheet['!cols'] = colWidths;
        
        // Add styling through cell types
        Object.keys(worksheet).forEach(cellAddress => {
          if (cellAddress === '!ref' || cellAddress === '!cols') return;
          
          const cell = worksheet[cellAddress];
          const { c: col, r: row } = XLSX.utils.decode_cell(cellAddress);        
          // Style headers
          if (row <= 3) {
            cell.s = {
              font: { bold: true, sz: 12 },
              fill: { fgColor: { rgb: "E8F5E9" } }
            };
          }
          
          // Style totals
          if (cell.v === 'Total Income:' || cell.v === 'Total Expenses:' || 
              cell.v === 'Opening Balance:' || cell.v === 'Closing Balance:') {
            cell.s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "FFF3E0" } }
            };
          }
          
          // Style amount cells
          if ((col === 2 || col === 6) && typeof cell.v === 'number') {
            cell.s = {
              numFmt: '#,##0.00'
            };
          }
        });
        
        workbook.Sheets[sheetName] = worksheet;
      });
      
      // Create Summary Sheet
      const summarySheetName = 'Summary';
      workbook.SheetNames.unshift(summarySheetName);
      
      const summaryData: (string | number)[][] = [
        ['FINANCIAL SUMMARY REPORT'],
        ['Generated on:', new Date().toLocaleDateString()],
        [],
        ['Month', 'Opening Balance', 'Total Income', 'Total Expenses', 'Net Balance', 'Closing Balance']
      ];
      
      let runningBalance = 0;
      sortedMonths.forEach(month => {
        const monthTransactions = transactionsByMonth[month];
        const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const netBalance = income - expenses;
        const openingBalance = runningBalance;
        const closingBalance = runningBalance + netBalance;
        
        summaryData.push([
          formatMonth(month),
          openingBalance,
          income,
          expenses,
          netBalance,
          closingBalance
        ]);
        
        runningBalance = closingBalance;
      });
      
      // Add totals row
      summaryData.push([]);
      summaryData.push(['TOTALS', 
        `=SUM(B5:B${summaryData.length - 1})`,
        `=SUM(C5:C${summaryData.length - 1})`,
        `=SUM(D5:D${summaryData.length - 1})`,
        `=SUM(E5:E${summaryData.length - 1})`,
        ''
      ]);
      
      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Style summary sheet
      Object.keys(summaryWorksheet).forEach(cellAddress => {
        if (cellAddress === '!ref') return;
        
        const cell = summaryWorksheet[cellAddress];
        const { c: col, r: row } = XLSX.utils.decode_cell(cellAddress);      
        // Style header
        if (row <= 3) {
          cell.s = {
            font: { bold: true, sz: 14 },
            fill: { fgColor: { rgb: "E3F2FD" } }
          };
        }
        
        // Style totals row
        if (row === summaryData.length - 1) {
          cell.s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFF3E0" } },
            border: {
              top: { style: 'medium', color: { rgb: "000000" } }
            }
          };
        }
        
        // Format numbers
        if (col >= 1 && col <= 5 && row >= 4 && typeof cell.v === 'number') {
          cell.s = {
            numFmt: '#,##0.00'
          };
        }
      });
      
      summaryWorksheet['!cols'] = [
        { wch: 25 }, // Month
        { wch: 15 }, // Opening Balance
        { wch: 15 }, // Income
        { wch: 15 }, // Expenses
        { wch: 15 }, // Net Balance
        { wch: 15 }  // Closing Balance
      ];
      
      workbook.Sheets[summarySheetName] = summaryWorksheet;
      
      // Download the Excel file
      XLSX.writeFile(workbook, `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      alert('Error downloading transactions file');
    }
  };

  // Add refreshing overlay
  const RefreshingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 rounded-2xl p-8 border border-cyan-500/30">
        <div className="flex flex-col items-center">
          <Loader className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
          <p className="text-white text-lg font-semibold">Updating data...</p>
          <p className="text-slate-400 text-sm mt-2">Please wait a moment</p>
        </div>
      </div>
    </div>
  );

  // Empty state for new users
  const EmptyState = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="relative z-10 bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 shadow-2xl max-w-2xl w-full text-center">
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to BudgetTracker!</h1>
          <p className="text-cyan-300 text-lg mb-6">
            {currentUserId ? `Hello User ${currentUserId.substring(0, 8)}...` : 'Welcome!'}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">No Transactions Yet</h2>
          <p className="text-slate-300 mb-6">
            Start tracking your finances by adding your first transaction.
          </p>
          <button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-8 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            + Add Your First Transaction
          </button>
        </div>

        <div className="text-slate-400 text-sm">
          <p>Your financial data will appear here once you start adding transactions.</p>
          <p className="mt-2">All data is securely stored and private to your account.</p>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* Loading Container */}
        <div className="relative z-10 bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 shadow-2xl max-w-2xl w-full">
          {/* Logo/Brand */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center animate-pulse">
                <Wallet className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center animate-bounce delay-300">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mt-6">BudgetTracker</h1>
            <p className="text-cyan-300 mt-2">Loading your financial dashboard</p>
            {currentUserId && (
              <p className="text-slate-400 text-sm mt-1">
                User: {currentUserId.substring(0, 8)}...
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-slate-300 mb-2">
              <span>Loading financial data...</span>
              <span>{loadingProgress}%</span>
            </div>
            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Loading Steps */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 30 ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-700/30'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 30 ? 'bg-cyan-500/20' : 'bg-slate-600/50'}`}>
                <Calendar className={`w-5 h-5 ${loadingProgress >= 30 ? 'text-cyan-400' : 'text-slate-400'}`} />
              </div>
              <p className={`text-sm font-medium ${loadingProgress >= 30 ? 'text-cyan-300' : 'text-slate-400'}`}>
                {loadingProgress >= 30 ? '✓' : '...'} Loading Months
              </p>
            </div>

            <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 60 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-700/30'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 60 ? 'bg-blue-500/20' : 'bg-slate-600/50'}`}>
                <TrendingUp className={`w-5 h-5 ${loadingProgress >= 60 ? 'text-blue-400' : 'text-slate-400'}`} />
              </div>
              <p className={`text-sm font-medium ${loadingProgress >= 60 ? 'text-blue-300' : 'text-slate-400'}`}>
                {loadingProgress >= 60 ? '✓' : '...'} Loading Transactions
              </p>
            </div>

            <div className={`text-center p-4 rounded-2xl transition-all duration-300 ${loadingProgress >= 90 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${loadingProgress >= 90 ? 'bg-emerald-500/20' : 'bg-slate-600/50'}`}>
                <Wallet className={`w-5 h-5 ${loadingProgress >= 90 ? 'text-emerald-400' : 'text-slate-400'}`} />
              </div>
              <p className={`text-sm font-medium ${loadingProgress >= 90 ? 'text-emerald-300' : 'text-slate-400'}`}>
                {loadingProgress >= 90 ? '✓' : '...'} Calculating Balances
              </p>
            </div>
          </div>

          {/* Loading Messages */}
          <div className="text-center">
            <div className="inline-block bg-slate-700/50 rounded-full px-4 py-2 mb-4">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 text-cyan-400 animate-spin" />
                <p className="text-slate-300 text-sm">
                  {loadingProgress < 30 && "Preparing your financial dashboard..."}
                  {loadingProgress >= 30 && loadingProgress < 60 && "Loading monthly transactions..."}
                  {loadingProgress >= 60 && loadingProgress < 90 && "Calculating opening balances..."}
                  {loadingProgress >= 90 && "Finalizing your financial overview..."}
                </p>
              </div>
            </div>
            
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              {loadingProgress < 50 
                ? "We're gathering your financial data from all sources to give you a complete picture."
                : "Analyzing your income and expenses to provide actionable insights for better financial management."
              }
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-full blur-2xl"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 rounded-full blur-2xl"></div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Please wait while we prepare your financial dashboard
          </p>
          <p className="text-slate-600 text-xs mt-1">
            This usually takes just a few moments...
          </p>
        </div>
      </div>
    );
  }

  // Show empty state for new users
  if (!hasData && !isLoading) {
    return <EmptyState />;
  }

  return (
    <>
      {isRefreshing && <RefreshingOverlay />}
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
        {/* Header */}
        <div className="mb-8">
          {/* Mobile Layout (shown on small screens) */}
          <div className="block lg:hidden">
            <div className="mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Financial Dashboard</h1>
                  <p className="text-blue-200">Track your income and expenses</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 ">
              <button 
                onClick={downloadExcel}
                className="w-full sm:w-auto bg-gradient-to-r  from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-4 py-3 rounded-xl font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">Download Excel</span>
              </button>
              <button 
                onClick={() => setShowForm(true)}
                className="w-full cursor-pointer sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-4 py-3 rounded-xl font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Transaction</span>
              </button>
            </div>
          </div>

          {/* Desktop Layout (shown on larger screens) */}
          <div className="hidden lg:flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Financial Dashboard</h1>
              <div className="flex items-center gap-4">
                <p className="text-blue-200 text-lg">Track your income and expenses</p>
                {currentUserId && (
                  <span className="text-sm text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full">
                    User: {currentUserId.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={downloadExcel}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
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
        <div className="mb-8 bg-gradient-to-br from-slate-800/60 to-blue-900/40 backdrop-blur-xl rounded-3xl p-8 border border-cyan-500/20 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500">
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
            <div className="p-2 bg-cyan-500/10 rounded-full border border-cyan-400/20">
              <span className="text-cyan-400 text-sm font-semibold">
                {selectedMonth ? formatMonth(selectedMonth) : 'Select'}
              </span>
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

        {/* Balance Summary Card */}
        <div className="mb-8 bg-gradient-to-br from-slate-800/80 via-blue-900/80 to-indigo-900/80 rounded-3xl shadow-2xl border border-slate-700/50 p-8 backdrop-blur-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Opening Balance */}
            <div className="text-center group">
              <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-2xl p-6 border border-cyan-700/30 group-hover:border-cyan-400 transition-all duration-300 group-hover:scale-105">
                <div className="text-cyan-300 font-semibold text-lg mb-3">Opening Balance</div>
                <div className="text-white font-bold text-3xl mb-2">Rs {openingBalance.toLocaleString()}</div>
                <div className="text-cyan-400/70 text-sm">Previous Month Balance</div>
              </div>
            </div>

            {/* Current Income */}
            <div className="text-center group">
              <div className="bg-gradient-to-br from-emerald-900/40 to-green-900/40 rounded-2xl p-6 border border-emerald-700/30 group-hover:border-emerald-400 transition-all duration-300 group-hover:scale-105">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-emerald-800/50 p-3 rounded-full mr-3">
                    <span className="text-emerald-300 text-xl">💰</span>
                  </div>
                  <div className="text-emerald-300 font-semibold text-lg">Income</div>
                </div>
                <div className="text-emerald-300 font-bold text-3xl">+Rs {totalIncome.toLocaleString()}</div>
              </div>
            </div>

            {/* Current Expenses */}
            <div className="text-center group">
              <div className="bg-gradient-to-br from-rose-900/40 to-red-900/40 rounded-2xl p-6 border border-rose-700/30 group-hover:border-rose-400 transition-all duration-300 group-hover:scale-105">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-rose-800/50 p-3 rounded-full mr-3">
                    <span className="text-rose-300 text-xl">💸</span>
                  </div>
                  <div className="text-rose-300 font-semibold text-lg">Expenses</div>
                </div>
                <div className="text-rose-300 font-bold text-3xl">-Rs {totalExpenses.toLocaleString()}</div>
              </div>
            </div>

            {/* Current Balance */}
            <div className="text-center group">
              <div className={`rounded-2xl p-6 border transition-all duration-300 group-hover:scale-105 ${
                currentBalance >= 0 
                  ? 'bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/30 group-hover:border-emerald-400' 
                  : 'bg-gradient-to-br from-rose-900/40 to-red-900/40 border-rose-700/30 group-hover:border-rose-400'
              }`}>
                <div className="flex items-center justify-center mb-3">
                  <div className={`p-3 rounded-full mr-3 ${
                    currentBalance >= 0 ? 'bg-emerald-800/50' : 'bg-rose-800/50'
                  }`}>
                    <span className={`text-xl ${
                      currentBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      ⚖️
                    </span>
                  </div>
                  <div className={`font-semibold text-lg ${
                    currentBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    Current Balance
                  </div>
                </div>
                <div className={`font-bold text-3xl ${
                    currentBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                  {currentBalance >= 0 ? '+' : ''}Rs {currentBalance.toLocaleString()}
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* Parallel Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Income Table */}
          <div className="bg-gradient-to-br from-slate-800/80 to-blue-900/80 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <span className="mr-3">💰</span>
                  Income Transactions
                </h2>
                <div className="bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-400/30">
                  <span className="font-semibold text-emerald-100">
                    Rs {totalIncome.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-emerald-900/30 border-b border-emerald-800/30">
                    <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Sr#</th>
                    <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Date</th>
                    <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Description</th>
                    <th className="text-right py-4 px-6 text-emerald-300 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeTransactions.map((transaction,index) => (
                    <tr 
                      key={transaction._id} 
                      className="border-b border-slate-700/30 hover:bg-emerald-900/20 transition-colors"
                    >
                      <td className="py-4 px-6 text-slate-200 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-4 px-6 text-slate-200 font-medium">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <div className="text-white font-semibold">
                            {transaction.name}
                          </div>
                          <div className="text-slate-400 text-sm mt-1">
                            {transaction.category}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-emerald-300">
                        +Rs {transaction.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {incomeTransactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        No income transactions for {selectedMonth ? formatMonth(selectedMonth) : 'this month'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-gradient-to-br from-slate-800/80 to-blue-900/80 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <span className="mr-3">💸</span>
                  Expense Transactions
                </h2>
                <div className="bg-rose-500/20 px-4 py-2 rounded-full border border-rose-400/30">
                  <span className="font-semibold text-rose-100">
                    Rs {totalExpenses.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-rose-900/30 border-b border-rose-800/30">
                    <th className="text-left py-4 px-6 text-rose-300 font-semibold">Sr#</th>
                    <th className="text-left py-4 px-6 text-rose-300 font-semibold">Date</th>
                    <th className="text-left py-4 px-6 text-rose-300 font-semibold">Description</th>
                    <th className="text-right py-4 px-6 text-rose-300 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseTransactions.map((transaction,index) => (
                    <tr 
                      key={transaction._id} 
                      className="border-b border-slate-700/30 hover:bg-rose-900/20 transition-colors"
                    >
                      <td className="py-4 px-6 text-slate-200 font-medium">
                        {index+1}
                      </td>
                      <td className="py-4 px-6 text-slate-200 font-medium">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <div className="text-white font-semibold">
                            {transaction.name}
                          </div>
                          <div className="text-slate-400 text-sm mt-1">
                            {transaction.category}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-rose-300">
                        -Rs {transaction.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {expenseTransactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        No expense transactions for {selectedMonth ? formatMonth(selectedMonth) : 'this month'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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