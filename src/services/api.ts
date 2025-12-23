import axios from 'axios';
import { Transaction, MonthlySummary } from '../types';

const API_URL = 'https://budgetbackend-shoa.onrender.com/api';
// const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (userData: { name: string; email: string; password: string }) =>
    api.post('/auth/register', userData),
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// ... existing code ...

export const transactionAPI = {
  getTransactions: (monthYear?: string) =>
    api.get<Transaction[]>(`/transactions${monthYear ? `?monthYear=${monthYear}` : ''}`),
  createTransaction: (transaction: Omit<Transaction, '_id' | 'monthYear'>) =>
    api.post<Transaction>('/transactions', transaction),
  getMonthlySummary: (monthYear: string) =>
    api.get<MonthlySummary>(`/transactions/summary/${monthYear}`),
  getAvailableMonths: () => api.get<string[]>('/transactions/months'),
   updateTransaction: (id: string, transaction: Partial<Transaction>) =>
    api.put<Transaction>(`/transactions/${id}`, transaction),
  deleteTransaction: (id: string) =>
    api.delete(`/transactions/${id}`),
  downloadExcelReport: (data: any) => axios.post('/api/transactions/download-excel', data, {
  responseType: 'blob'
}),
};

export default api;