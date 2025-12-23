import React, { useState, useEffect,useCallback  } from 'react';
import { transactionAPI } from '../services/api';
import { Transaction, MonthlySummary } from '../types';
import TransactionForm from './Transactions';
import { Calendar, Loader, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';

const Dashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [, setSummary] = useState<MonthlySummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [loadingProgress, setLoadingProgress] = useState(0); 

  useEffect(() => {
    loadAvailableMonths();
  }, []);

 const loadAvailableMonths = async () => {
    try {
      setIsLoading(true);
      setLoadingProgress(20);
      const months = await transactionAPI.getAvailableMonths();
      setAvailableMonths(months.data);
      if (months.data.length > 0) {
        setSelectedMonth(months.data[0]);
      }
      setLoadingProgress(40);
    } catch (error) {
      console.error('Error loading months:', error);
    }
  };

  const loadTransactions = useCallback(async () => {
    try {
      setLoadingProgress(60);
      const response = await transactionAPI.getTransactions(selectedMonth);
      setTransactions(response.data);
      setLoadingProgress(80);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, [selectedMonth]);

  const loadMonthlySummary = useCallback(async () => {
    try {
      const response = await transactionAPI.getMonthlySummary(selectedMonth);
      setSummary(response.data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }, [selectedMonth]);

  const calculateOpeningBalance = useCallback(async () => {
    try {
      if (!selectedMonth || availableMonths.length === 0) {
        setOpeningBalance(0);
        return;
      }

      // Sort months chronologically (oldest first)
      const sortedMonths = [...availableMonths].sort();
      
      const currentIndex = sortedMonths.indexOf(selectedMonth);
      
      if (currentIndex === 0) {
        // First month - opening balance is 0
        setOpeningBalance(0);
        return;
      }

      // Calculate cumulative balance from all previous months
      let cumulativeBalance = 0;
      
      // Process each month from the beginning up to the month before current
      for (let i = 0; i < currentIndex; i++) {
        const month = sortedMonths[i];
        const monthSummary = await transactionAPI.getMonthlySummary(month);
        
        cumulativeBalance = cumulativeBalance + monthSummary.data.totalIncome - monthSummary.data.totalExpenses;
      }
      
      setOpeningBalance(cumulativeBalance);
      setLoadingProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
      
    } catch (error) {
      console.error('Error calculating opening balance:', error);
      setOpeningBalance(0);
      setIsLoading(false);
    }
  }, [selectedMonth, availableMonths]);

  useEffect(() => {
    if (selectedMonth) {
      setIsLoading(true);
      setLoadingProgress(0);
      loadTransactions();
      loadMonthlySummary();
      calculateOpeningBalance();
    }
  }, [selectedMonth, loadTransactions, loadMonthlySummary, calculateOpeningBalance]);

  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Download Excel Report

const downloadExcel = async () => {
  try {
    // Get all transactions for all months
    const allTransactions = await transactionAPI.getTransactions();
    
    // Group transactions by month
    const transactionsByMonth: { [key: string]: Transaction[] } = {};
    
    allTransactions.data.forEach((transaction: Transaction) => {
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
    
    sortedMonths.forEach((month, monthIndex) => {
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
      // sheetData.push(['', 'Amount (PKR)', '', 'Amount (PKR)']);
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
        if ((col === 4 || col === 5) && typeof cell.v === 'number') {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      {/* Header */}
<div className="mb-8">
  {/* Mobile Layout (shown on small screens) */}
  <div className="block lg:hidden">
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-white mb-2">Financial Dashboard</h1>
      <p className="text-blue-200">Track your income and expenses</p>
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
      <p className="text-blue-200 text-lg">Track your income and expenses</p>
    </div>
    <div className="flex gap-4">
      <button 
        onClick={downloadExcel}
        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download Excel
      </button>
      <button 
        onClick={() => setShowForm(true)}
        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-8 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105"
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
  onTransactionUpdated={() => {
    loadTransactions();
    loadMonthlySummary();
    loadAvailableMonths();
  }}
      />
    </div>
  );
};

export default Dashboard;