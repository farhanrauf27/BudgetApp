import React, { useState, useEffect,useCallback  } from 'react';
import { transactionAPI } from '../services/api';
import { Transaction, MonthlySummary } from '../types';
import TransactionForm from './Transactions';
import { Calendar } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [, setSummary] = useState<MonthlySummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

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

  const loadTransactions = useCallback(async () => {
    try {
      const response = await transactionAPI.getTransactions(selectedMonth);
      setTransactions(response.data);
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
      
      // Opening Balance + Income - Expenses = Current Balance
      // This current balance becomes the opening balance for next month
      cumulativeBalance = cumulativeBalance + monthSummary.data.totalIncome - monthSummary.data.totalExpenses;
      
    }
    
    setOpeningBalance(cumulativeBalance);
    
  } catch (error) {
    console.error('Error calculating opening balance:', error);
    setOpeningBalance(0);
  }
}, [selectedMonth, availableMonths]);

useEffect(() => {
  if (selectedMonth) {
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

//   const downloadExcel = async () => {
//   try {
//     // Get all transactions for all months
//     const allTransactions = await transactionAPI.getTransactions();
    
//     // Group transactions by month
//     const transactionsByMonth: { [key: string]: Transaction[] } = {};
    
//     allTransactions.data.forEach((transaction: Transaction) => {
//       const monthYear = transaction.date.substring(0, 7); // YYYY-MM format
//       if (!transactionsByMonth[monthYear]) {
//         transactionsByMonth[monthYear] = [];
//       }
//       transactionsByMonth[monthYear].push(transaction);
//     });

//     // Create Excel data with better structure
//     const excelData: (string | number)[][] = [];
    
//     // Add title row
//     excelData.push(['Financial Transactions Report', '', '', '', '', '']);
//     excelData.push(['Generated on:', new Date().toLocaleDateString(), '', '', '', '']);
//     excelData.push([]); // Empty row

//     // Sort months chronologically
//     const sortedMonths = Object.keys(transactionsByMonth).sort();
    
//     // Track previous month's balance for cumulative calculation
//     let previousMonthBalance = 0;
    
//     // Add data for each month
//     sortedMonths.forEach((month, monthIndex) => {
//       const monthTransactions = transactionsByMonth[month];
      
//       // Add month header with styling
//       excelData.push([formatMonth(month), '', '', '', '', '']);
//       excelData.push([]); // Empty row
      
//       // Add Opening Balance
//       excelData.push(['Opening Balance', '', '', '', previousMonthBalance]);
      
      
//       // Add table headers
//       excelData.push([
//         'Date',
//         'Name', 
//         'Description',
//         'Type',
//         'Amount (PKR)'
//       ]);
      
//       cons incomeRowStart = 0;
//       let expenseRowStart = 0;
      
//       // Add income transactions first
//       const incomeTransactions = monthTransactions.filter(t => t.type === 'income');
//       if (incomeTransactions.length > 0) {
//         incomeRowStart = excelData.length + 1;
//         incomeTransactions.forEach((transaction) => {
//           excelData.push([
//             formatDate(transaction.date),
//             transaction.name,
//             transaction.description || '',
//             'Income',
//             transaction.amount
//           ]);
//         });
//       }
      
//       // Add expense transactions
//       const expenseTransactions = monthTransactions.filter(t => t.type === 'expense');
//       if (expenseTransactions.length > 0) {
//         expenseRowStart = excelData.length + 1;
//         expenseTransactions.forEach((transaction) => {
//           excelData.push([
//             formatDate(transaction.date),
//             transaction.name,
//             transaction.description || '',
//             'Expense',
//             -transaction.amount
//           ]);
//         });
//       }
      
//       // Add summary section
//       excelData.push([]);
//       excelData.push(['Monthly Summary', '', '', '', '']);  
      
      
//       // Store this month's balance for next month's opening balance
//       const monthlyIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
//       const monthlyExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
//       previousMonthBalance = previousMonthBalance + monthlyIncome - monthlyExpenses;
      
//       // Add empty rows between months
//       excelData.push([]);
//       excelData.push([]);
//     });

//     // Add grand summary at the end
//     excelData.push(['GRAND SUMMARY', '', '', '', '']);
    
//     // Find all summary rows and create formulas
//     let grandIncomeFormula = '=';
//     let grandExpensesFormula = '=';
    
//     sortedMonths.forEach((month, index) => {
//       // Calculate row numbers for each month's summary
//       const monthOffset = 10 + (index * 18); // Adjusted offset for opening balance
//       grandIncomeFormula += (index > 0 ? '+' : '') + `E${monthOffset + 4}`; // Total Income rows
//       grandExpensesFormula += (index > 0 ? '+' : '') + `E${monthOffset + 5}`; // Total Expenses rows
//     });
    
//     excelData.push(['', '', '', 'Total Income (All Months):', grandIncomeFormula]);
//     excelData.push(['', '', '', 'Total Expenses (All Months):', grandExpensesFormula]);
//     excelData.push(['', '', '', 'Final Balance:', 
//       `=E${excelData.length - 2}-E${excelData.length - 1}`
//     ]);

//     // Convert to CSV with proper formatting
//     const csvContent = excelData.map((row) => {
//       return row.map(cell => {
//         if (cell === null || cell === undefined) return '""';
//         if (typeof cell === 'number') return cell.toString();
//         return `"${cell}"`;
//       }).join(',');
//     }).join('\n');

//     // Create and download file
//     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//     const link = document.createElement('a');
//     const url = URL.createObjectURL(blob);
    
//     link.setAttribute('href', url);
//     link.setAttribute('download', `financial-report-${new Date().toISOString().split('T')[0]}.csv`);
//     link.style.visibility = 'hidden';
    
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
    
//   } catch (error) {
//     console.error('Error downloading Excel file:', error);
//     alert('Error downloading transactions file');
//   }
// };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      {/* Header */}
<div className="flex justify-between items-center mb-8">
  <div>
    <h1 className="text-4xl font-bold text-white mb-2">Financial Dashboard</h1>
    <p className="text-blue-200 text-lg">Track your income and expenses</p>
  </div>
  <div className="flex gap-4">
    <button 
      // onClick={downloadExcel}
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