// src/components/LendingList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { lendingAPI } from '../services/api';
import { Lending, LendingStatistics } from '../types/lending';
import { 
  Plus, User, DollarSign, Calendar, Edit, Trash2, CheckCircle, 
  Clock, TrendingUp, TrendingDown, Wallet, Filter,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import LendingForm from './LendingForm';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const LendingList: React.FC = () => {
  const [lendings, setLendings] = useState<Lending[]>([]);
  const [statistics, setStatistics] = useState<LendingStatistics>({
    lend: { total: 0, pending: 0, paid: 0, count: 0, pendingCount: 0 },
    borrow: { total: 0, pending: 0, received: 0, count: 0, pendingCount: 0 },
    netBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLending, setEditingLending] = useState<Lending | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'lend' | 'borrow'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'received'>('all');

  // Calculate statistics from lendings array
  const calculateLocalStatistics = (lendingsArray: Lending[]): LendingStatistics => {
    const result = {
      lend: { total: 0, pending: 0, paid: 0, count: 0, pendingCount: 0 },
      borrow: { total: 0, pending: 0, received: 0, count: 0, pendingCount: 0 },
      netBalance: 0
    };

    lendingsArray.forEach(lending => {
      if (lending.type === 'lend') {
        result.lend.total += lending.amount;
        result.lend.count += 1;
        
        if (lending.status === 'pending') {
          result.lend.pending += lending.amount;
          result.lend.pendingCount += 1;
        } else if (lending.status === 'paid') {
          result.lend.paid += lending.amount;
        }
      } else if (lending.type === 'borrow') {
        result.borrow.total += lending.amount;
        result.borrow.count += 1;
        
        if (lending.status === 'pending') {
          result.borrow.pending += lending.amount;
          result.borrow.pendingCount += 1;
        } else if (lending.status === 'received') {
          result.borrow.received += lending.amount;
        }
      }
    });

    result.netBalance = result.lend.pending - result.borrow.pending;
    return result;
  };

  // Load data from API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;

      console.log('Loading data with params:', params);

      // Try to get data from API
      const lendingsRes = await lendingAPI.getLendings(params);
      console.log('Lendings response:', lendingsRes);

      const newLendings = (lendingsRes as any).lendings || [];
      console.log('New lendings:', newLendings);

      // Update lendings state
      setLendings(newLendings);
      
      // Calculate and update statistics locally
      const localStats = calculateLocalStatistics(newLendings);
      setStatistics(localStats);
      
      console.log('Local stats calculated:', localStats);
      
    } catch (err: any) {
      console.error('Load data error:', err);
      setError(err.response?.message || 'Failed to load data');
      
      // Reset to empty state on error
      setLendings([]);
      setStatistics({
        lend: { total: 0, pending: 0, paid: 0, count: 0, pendingCount: 0 },
        borrow: { total: 0, pending: 0, received: 0, count: 0, pendingCount: 0 },
        netBalance: 0
      });
      
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update statistics when lendings change
  useEffect(() => {
    if (lendings.length > 0) {
      const newStats = calculateLocalStatistics(lendings);
      setStatistics(newStats);
    }
  }, [lendings]);

  const handleStatusUpdate = async (id: string, newStatus: 'paid' | 'received') => {
    try {
      // Optimistic update
      const updatedLendings = lendings.map(lending => 
        lending._id === id ? { ...lending, status: newStatus } : lending
      );
      
      setLendings(updatedLendings);
      
      // Call API in background
      lendingAPI.updateStatus(id, newStatus).catch(err => {
        console.error('Failed to update status:', err);
        // Revert on error
        loadData();
      });
      
      // Show success
      MySwal.fire({
        title: 'Updated!',
        text: `Status updated to ${newStatus}`,
        icon: 'success',
        iconColor: '#10b981',
        background: '#1e293b',
        timer: 1500,
        showConfirmButton: false
      });
      
    } catch (err: any) {
      console.error('Error updating status:', err);
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const lending = lendings.find(l => l._id === id);
    const personName = lending?.personName || 'this record';
    const amount = formatCurrency(lending?.amount || 0);
    const typeText = lending?.type === 'lend' ? 'lending to' : 'borrowing from';

    const result = await MySwal.fire({
      title: 'Delete Record?',
      html: (
        <div className="text-slate-300 text-left">
          <p>Are you sure you want to delete {typeText} <strong className="text-white">"{personName}"</strong> for <strong className="text-rose-400">{amount}</strong>?</p>
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <p className="text-rose-300 text-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              This action cannot be undone
            </p>
          </div>
        </div>
      ),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      customClass: {
        popup: 'bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl',
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      try {
        // Optimistic update
        const updatedLendings = lendings.filter(lending => lending._id !== id);
        setLendings(updatedLendings);
        
        // Call API in background
        lendingAPI.deleteLending(id).catch(err => {
          console.error('Failed to delete:', err);
          loadData();
        });
        
        // Show success
        MySwal.fire({
          title: 'Deleted!',
          text: 'Record has been deleted.',
          icon: 'success',
          iconColor: '#10b981',
          background: '#1e293b',
          timer: 2000,
          showConfirmButton: false
        });
        
      } catch (err: any) {
        loadData();
        MySwal.fire({
          title: 'Error!',
          text: err.response?.message || 'Failed to delete record',
          icon: 'error',
          confirmButtonColor: '#dc2626',
          background: '#1e293b'
        });
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount).replace('PKR', 'Rs');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusBadge = (status: string, type: 'lend' | 'borrow') => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-medium border";
    
    if (status === 'pending') {
      return (
        <span className={`${baseClasses} bg-amber-900/30 text-amber-400 border-amber-800/30`}>
          <Clock className="w-3 h-3 inline mr-1" />
          Pending
        </span>
      );
    } else if (status === 'paid') {
      return (
        <span className={`${baseClasses} bg-emerald-900/30 text-emerald-400 border-emerald-800/30`}>
          <CheckCircle className="w-3 h-3 inline mr-1" />
          Paid
        </span>
      );
    } else if (status === 'received') {
      return (
        <span className={`${baseClasses} bg-emerald-900/30 text-emerald-400 border-emerald-800/30`}>
          <CheckCircle className="w-3 h-3 inline mr-1" />
          Received
        </span>
      );
    }
    return null;
  };

  // Show loading only initially
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading lending data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="block lg:hidden">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Lending & Borrowing</h1>
            <p className="text-blue-200">Track money you lend and borrow</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-4 py-3 rounded-xl font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Add Record
            </button>
          </div>
        </div>

        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Lending & Borrowing</h1>
            <p className="text-blue-200 text-lg">Track money you lend and borrow</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-8 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer"
            >
              + Add Record
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Net Balance */}
        <div className="bg-gradient-to-br from-slate-800/80 to-blue-900/80 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Net Balance</p>
              <p className={`text-2xl font-bold mt-2 ${
                statistics.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {statistics.netBalance >= 0 ? '+' : ''}{formatCurrency(statistics.netBalance)}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                You {statistics.netBalance >= 0 ? 'are owed' : 'owe'} money
              </p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <Wallet className={`w-6 h-6 ${
                statistics.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`} />
            </div>
          </div>
        </div>

        {/* Lending Stats */}
        <div className="bg-gradient-to-br from-slate-800/80 to-emerald-900/60 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">You Lent</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">
                {formatCurrency(statistics.lend.total)}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {statistics.lend.count} records • {statistics.lend.pendingCount} pending
              </p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Pending:</span>
              <span className="text-amber-400">{formatCurrency(statistics.lend.pending)}</span>
            </div>
          </div>
        </div>

        {/* Borrowing Stats */}
        <div className="bg-gradient-to-br from-slate-800/80 to-rose-900/60 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">You Borrowed</p>
              <p className="text-2xl font-bold text-rose-400 mt-2">
                {formatCurrency(statistics.borrow.total)}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {statistics.borrow.count} records • {statistics.borrow.pendingCount} pending
              </p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <TrendingDown className="w-6 h-6 text-rose-400" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Pending:</span>
              <span className="text-amber-400">{formatCurrency(statistics.borrow.pending)}</span>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-slate-800/80 to-purple-900/60 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Summary</p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400 mr-2" />
                <span className="text-emerald-400 font-bold">
                  {formatCurrency(statistics.lend.pending)}
                </span>
                <span className="text-slate-500 text-sm ml-2">to receive</span>
              </div>
              <div className="flex items-center mt-1">
                <ArrowDownRight className="w-5 h-5 text-rose-400 mr-2" />
                <span className="text-rose-400 font-bold">
                  {formatCurrency(statistics.borrow.pending)}
                </span>
                <span className="text-slate-500 text-sm ml-2">to pay</span>
              </div>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 shadow-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Filters</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-sm">Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-700/50 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="lend">Lending</option>
                <option value="borrow">Borrowing</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-sm">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-700/50 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="received">Received</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setFilterType('all');
                setFilterStatus('all');
              }}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors duration-200 text-sm cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <span className="text-rose-300">{error}</span>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-300 cursor-pointer">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Two Tables Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lending Table */}
        <div className="bg-gradient-to-br from-slate-800/80 to-emerald-900/40 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <TrendingUp className="mr-3" />
                Money You Lent
              </h2>
              <div className="bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-400/30">
                <span className="font-semibold text-emerald-100">
                  {lendings.filter(l => l.type === 'lend').length} records
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-emerald-900/30 border-b border-emerald-800/30">
                  <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Person</th>
                  <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Amount</th>
                  <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-emerald-300 font-semibold">Date</th>
                  <th className="text-center py-4 px-6 text-emerald-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lendings
                  .filter(l => l.type === 'lend')
                  .map((lending) => (
                    <tr key={lending._id} className="border-b border-slate-700/30 hover:bg-emerald-900/20 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-slate-400 mr-2" />
                          <div>
                            <div className="text-white font-semibold">{lending.personName}</div>
                            {lending.description && (
                              <div className="text-slate-400 text-sm mt-1">{lending.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-emerald-300 font-bold">
                          {formatCurrency(lending.amount)}
                        </div>
                        {lending.dueDate && (
                          <div className="text-slate-400 text-xs mt-1 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            Due: {formatDate(lending.dueDate)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(lending.status, lending.type)}
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {formatDate(lending.dueDate)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center gap-2">
                          {lending.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(lending._id, 'paid')}
                              className="p-2 text-emerald-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                              title="Mark as paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingLending(lending);
                              setShowForm(true);
                            }}
                            className="p-2 text-blue-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lending._id)}
                            className="p-2 text-rose-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {lendings.filter(l => l.type === 'lend').length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center">
                        <TrendingUp className="w-12 h-12 mb-3 opacity-50" />
                        <p>No lending records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Borrowing Table */}
        <div className="bg-gradient-to-br from-slate-800/80 to-rose-900/40 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <TrendingDown className="mr-3" />
                Money You Borrowed
              </h2>
              <div className="bg-rose-500/20 px-4 py-2 rounded-full border border-rose-400/30">
                <span className="font-semibold text-rose-100">
                  {lendings.filter(l => l.type === 'borrow').length} records
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-rose-900/30 border-b border-rose-800/30">
                  <th className="text-left py-4 px-6 text-rose-300 font-semibold">Person</th>
                  <th className="text-left py-4 px-6 text-rose-300 font-semibold">Amount</th>
                  <th className="text-left py-4 px-6 text-rose-300 font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-rose-300 font-semibold">Date</th>
                  <th className="text-center py-4 px-6 text-rose-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lendings
                  .filter(l => l.type === 'borrow')
                  .map((lending) => (
                    <tr key={lending._id} className="border-b border-slate-700/30 hover:bg-rose-900/20 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-slate-400 mr-2" />
                          <div>
                            <div className="text-white font-semibold">{lending.personName}</div>
                            {lending.description && (
                              <div className="text-slate-400 text-sm mt-1">{lending.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-rose-300 font-bold">
                          {formatCurrency(lending.amount)}
                        </div>
                        {lending.dueDate && (
                          <div className="text-slate-400 text-xs mt-1 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            Due: {formatDate(lending.dueDate)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(lending.status, lending.type)}
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {formatDate(lending.dueDate)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center gap-2">
                          {lending.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(lending._id, 'received')}
                              className="p-2 text-emerald-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                              title="Mark as received"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingLending(lending);
                              setShowForm(true);
                            }}
                            className="p-2 text-blue-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lending._id)}
                            className="p-2 text-rose-400 hover:bg-slate-700 rounded-xl transition-colors duration-200 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {lendings.filter(l => l.type === 'borrow').length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center">
                        <TrendingDown className="w-12 h-12 mb-3 opacity-50" />
                        <p>No borrowing records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lending Form Modal */}
      <LendingForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingLending(null);
        }}
        lending={editingLending}
        onSuccess={(newLending) => {
          console.log('Form onSuccess called with:', newLending);
          
          if (newLending) {
            let updatedLendings;
            
            if (editingLending) {
              updatedLendings = lendings.map(l => 
                l._id === newLending._id ? newLending : l
              );
            } else {
              updatedLendings = [newLending, ...lendings];
            }
            
            setLendings(updatedLendings);
            
            MySwal.fire({
              title: editingLending ? 'Updated!' : 'Created!',
              text: `Record ${editingLending ? 'updated' : 'created'} successfully`,
              icon: 'success',
              iconColor: '#10b981',
              background: '#1e293b',
              timer: 2000,
              showConfirmButton: false
            });
          } else {
            loadData();
          }
          
          setShowForm(false);
          setEditingLending(null);
        }}
      />
    </div>
  );
};

export default LendingList;