import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { transactionAPI } from '../services/api';
import { Transaction, MonthlySummary } from '../types';
import jsPDF from 'jspdf';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

const Analytics: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [yearlyIncomeData, setYearlyIncomeData] = useState<{ month: string; income: number }[]>([]);

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadTransactions();
      loadMonthlySummary();
      loadYearlyIncomeData(); // Add this line

    }
  }, [selectedMonth]);
  const loadYearlyIncomeData = async () => {
  const data = await getYearlyIncomeData();
  setYearlyIncomeData(data);
};

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

  const loadTransactions = async () => {
    try {
      const response = await transactionAPI.getTransactions(selectedMonth);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadMonthlySummary = async () => {
    try {
      const response = await transactionAPI.getMonthlySummary(selectedMonth);
      setSummary(response.data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  // Income by Client/Name
  const getIncomeByClientData = () => {
    const clientMap: { [key: string]: number } = {};
    
    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        clientMap[transaction.name] = (clientMap[transaction.name] || 0) + transaction.amount;
      }
    });

    return Object.entries(clientMap)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value,
        fullName: name
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Show top 8 clients
  };

  // Yearly Income Data
  // Yearly Income Data with Monthly Breakdown
// Yearly Income Data - All months of the year
const getYearlyIncomeData = async () => {
  try {
    const monthlyData: { month: string; income: number }[] = [];
    
    // Get current year from selected month or use current year
    const currentYear = selectedMonth ? selectedMonth.split('-')[0] : new Date().getFullYear().toString();
    
    // Create data for all 12 months
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
      const monthName = new Date(parseInt(currentYear), i - 1).toLocaleDateString('en-US', {
        month: 'short'
      });
      
      try {
        // Fetch transactions for this specific month
        const response = await transactionAPI.getTransactions(monthKey);
        const monthTransactions = response.data.filter((t: Transaction) => t.type === 'income');
        
        const monthlyIncome = monthTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        
        monthlyData.push({
          month: monthName,
          income: monthlyIncome
        });
      } catch (error) {
        // If no data for this month, set income to 0
        monthlyData.push({
          month: monthName,
          income: 0
        });
      }
    }
    
    console.log('Yearly Income Data:', monthlyData);
    return monthlyData;
    
  } catch (error) {
    console.error('Error fetching yearly income data:', error);
    return [];
  }
};

  const getIncomeExpenseData = () => {
    const dailyData: { [key: string]: { income: number; expense: number } } = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date).getDate();
      if (!dailyData[date]) {
        dailyData[date] = { income: 0, expense: 0 };
      }
      
      if (transaction.type === 'income') {
        dailyData[date].income += transaction.amount;
      } else {
        dailyData[date].expense += transaction.amount;
      }
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: `Day ${date}`,
        income: data.income,
        expense: data.expense
      }))
      .sort((a, b) => parseInt(a.date.split(' ')[1]) - parseInt(b.date.split(' ')[1]));
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const monthName = formatMonth(selectedMonth);

    // Title
    doc.setFontSize(20);
    doc.text(`Budget Report - ${monthName}`, 20, 20);

    // Summary
    doc.setFontSize(12);
    doc.text(`Total Income: Rs ${summary?.totalIncome.toLocaleString()}`, 20, 40);
    doc.text(`Total Expenses: Rs ${summary?.totalExpenses.toLocaleString()}`, 20, 50);
    doc.text(`Savings: Rs ${summary?.savings.toLocaleString()}`, 20, 60);

    // Transactions
    doc.text('Transactions:', 20, 80);
    let yPosition = 90;
    transactions.forEach((transaction, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(
        `${index + 1}. ${transaction.description} - Rs ${transaction.amount} (${transaction.type})`,
        25,
        yPosition
      );
      yPosition += 10;
    });

    doc.save(`budget-report-${selectedMonth}.pdf`);
  };

  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const incomeByClientData = getIncomeByClientData();
  // const yearlyIncomeData = getYearlyIncomeData();
  const incomeExpenseData = getIncomeExpenseData();

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-600 rounded-lg p-3 shadow-2xl">
          <p className="text-white font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: Rs {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Analytics & Reports</h1>
          <p className="text-blue-200 text-lg">Deep insights into your financial data</p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={!transactions.length}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-2xl flex items-center"
        >
          <span className="mr-2">📄</span>
          Download PDF
        </button>
      </div>

      {/* Month Selector */}
      <div className="mb-8 bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
        <label className="block text-blue-200 font-semibold mb-3 text-lg">Select Month</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          {availableMonths.map(month => (
            <option key={month} value={month} className="bg-slate-800">
              {formatMonth(month)}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Income */}
          <div className="bg-gradient-to-br from-emerald-900/40 to-green-900/40 rounded-2xl p-6 border border-emerald-700/30">
            <div className="text-emerald-300 font-semibold text-lg mb-2">Total Income</div>
            <div className="text-emerald-300 font-bold text-3xl">Rs {summary.totalIncome.toLocaleString()}</div>
          </div>

          {/* Total Expenses */}
          <div className="bg-gradient-to-br from-rose-900/40 to-red-900/40 rounded-2xl p-6 border border-rose-700/30">
            <div className="text-rose-300 font-semibold text-lg mb-2">Total Expenses</div>
            <div className="text-rose-300 font-bold text-3xl">Rs {summary.totalExpenses.toLocaleString()}</div>
          </div>

          {/* Savings */}
          <div className={`rounded-2xl p-6 border ${
            summary.savings >= 0 
              ? 'bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/30' 
              : 'bg-gradient-to-br from-rose-900/40 to-red-900/40 border-rose-700/30'
          }`}>
            <div className={`font-semibold text-lg mb-2 ${
              summary.savings >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              Savings
            </div>
            <div className={`font-bold text-3xl ${
              summary.savings >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              Rs {summary.savings.toLocaleString()}
            </div>
          </div>

          {/* Transactions Count */}
          <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-2xl p-6 border border-cyan-700/30">
            <div className="text-cyan-300 font-semibold text-lg mb-2">Transactions</div>
            <div className="text-cyan-300 font-bold text-3xl">{summary.transactionCount}</div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Income by Client */}
        <div className="bg-gradient-to-br from-slate-800/60 to-purple-900/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-600/30 shadow-2xl">
  {/* Header with Glass Effect */}
  <div className="bg-slate-700/30 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-slate-600/20">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-2xl mr-4">
          <span className="text-2xl">👥</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">Clients Overview</h3>
          <p className="text-purple-300 text-sm mt-1">Income distribution by client</p>
        </div>
      </div>
      <div className="bg-purple-500/20 px-4 py-2 rounded-full border border-purple-400/30">
        <span className="text-purple-300 font-semibold text-sm">
          {incomeByClientData.length} Clients
        </span>
      </div>
    </div>
  </div>

  <div className="flex flex-col lg:flex-row items-start gap-6">
    {/* Pie Chart - Left Side */}
    <div className="flex-1">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={incomeByClientData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            dataKey="value"
          >
            {incomeByClientData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                stroke="#1E293B"
                strokeWidth={2}
                className="transition-all duration-300 hover:opacity-80"
              />
            ))}
          </Pie>
          <Tooltip 
            content={<CustomTooltip />}
            formatter={(value: number) => [`Rs ${value.toLocaleString()}`, 'Income']}
          />
          <Legend 
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry, index) => (
              <span className="text-xs text-slate-300">
                {incomeByClientData[index]?.name}
              </span>
            )}
            iconSize={10}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>

    {/* Client List - Right Side - Compact */}
    <div className="flex-1 max-w-full lg:max-w-[200px]">
      <div className="space-y-2">
        {incomeByClientData.slice(0, 5).map((client, index) => (
          <div
            key={client.fullName}
            className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-3 border border-slate-600/20 hover:border-purple-500/30 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <div
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <div className="text-white font-medium text-xs truncate">
                  {client.name}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-purple-300 font-bold text-sm">
                  Rs {(client.value / 1000).toFixed(0)}k
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Show more indicator if there are more clients */}
      {incomeByClientData.length > 5 && (
        <div className="text-center mt-3">
          <div className="text-slate-400 text-xs">
            +{incomeByClientData.length - 5} more clients
          </div>
        </div>
      )}
    </div>
  </div>

  {/* Footer Stats */}
  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-600/30">
    <div className="text-slate-400 text-sm">
      Total: Rs {incomeByClientData.reduce((sum, client) => sum + client.value, 0).toLocaleString()}
    </div>
    <div className="text-purple-400 text-sm font-semibold">
      Top: {incomeByClientData[0]?.name || 'N/A'}
    </div>
  </div>
</div>

        {/* Yearly Income */}
        <div className="bg-gradient-to-br from-slate-800/60 to-blue-900/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-600/30 shadow-2xl">
  {/* Header with Glass Effect */}
  <div className="bg-slate-700/30 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-slate-600/20">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-3 rounded-2xl mr-4">
          <span className="text-2xl">📈</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">Annual Income</h3>
          <p className="text-emerald-300 text-sm mt-1">Monthly breakdown for {selectedMonth ? selectedMonth.split('-')[0] : 'current year'}</p>
        </div>
      </div>
      <div className="bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-400/30">
        <span className="text-emerald-300 font-semibold text-sm">
          Total: Rs {yearlyIncomeData.reduce((sum, month) => sum + month.income, 0).toLocaleString()}
        </span>
      </div>
    </div>
  </div>

  {/* Chart Container */}
  <div className="relative">
    <ResponsiveContainer width="100%" height={320}>
      <BarChart 
        data={yearlyIncomeData}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        <defs>
          <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.9}/>
            <stop offset="50%" stopColor="#10B981" stopOpacity={0.6}/>
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.3}/>
          </linearGradient>
          <linearGradient id="hoverGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity={1}/>
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.8}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#4B5563" 
          strokeOpacity={0.3}
          vertical={false}
        />
        
        <XAxis 
          dataKey="month" 
          stroke="#9CA3AF"
          fontSize={12}
          fontWeight="500"
          tickLine={false}
          axisLine={{ stroke: '#4B5563', strokeOpacity: 0.5 }}
        />
        
        <YAxis 
          stroke="#9CA3AF"
          fontSize={11}
          fontWeight="500"
          tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
          tickLine={false}
          axisLine={{ stroke: '#4B5563', strokeOpacity: 0.5 }}
        />
        
        <Tooltip 
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
        />
        
        <Bar 
          dataKey="income" 
          fill="url(#premiumGradient)"
          radius={[6, 6, 0, 0]}
          name="Monthly Income"
          maxBarSize={40}
          className="transition-all duration-300 hover:fill-url(#hoverGradient)"
        />
      </BarChart>
    </ResponsiveContainer>
    
    {/* Chart Decoration */}
    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
  </div>

  {/* Footer Stats */}
  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-600/30">
    <div className="text-slate-400 text-sm">
      {yearlyIncomeData.filter(month => month.income > 0).length} months with income
    </div>
    <div className="text-emerald-400 text-sm font-semibold">
      Peak: Rs {Math.max(...yearlyIncomeData.map(m => m.income)).toLocaleString()}
    </div>
  </div>
</div>

        {/* Income vs Expenses */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white flex items-center">
              <span className="mr-3">⚖️</span>
              Income vs Expenses
            </h3>
            <div className="text-slate-400 text-sm">
              Daily Comparison
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incomeExpenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white flex items-center">
              <span className="mr-3">📈</span>
              Daily Trend
            </h3>
            <div className="text-slate-400 text-sm">
              Monthly Pattern
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={incomeExpenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                name="Income" 
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="#EF4444" 
                strokeWidth={3}
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                name="Expense" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;