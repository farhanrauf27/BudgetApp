import axios from 'axios';
import { Transaction, MonthlySummary } from '../types';
import ApiCache from './api-cache';
import batcher from './api-batcher';

const API_URL = 'https://budgetbackend-shoa.onrender.com/api';
// const API_URL = 'http://localhost:5000/api';

// Create axios instance with optimized defaults
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Request queue to prevent duplicate requests
const pendingRequests = new Map<string, Promise<any>>();

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add cache busting for POST, PUT, DELETE requests
  if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  }
  
  return config;
});

// Response interceptor with caching
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method?.toLowerCase() === 'get' && response.status === 200) {
      const cacheKey = ApiCache.generateKey( // ✅ Now using static method
        response.config.method,
        response.config.url || '',
        response.config.params
      );
      ApiCache.set(cacheKey, response.data);
    }
    return response;
  },
  (error) => {
    // Clear cache on auth errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      ApiCache.clear();
    }
    return Promise.reject(error);
  }
);

// Optimized request function with caching and request deduplication
const cachedRequest = async <T>(
  method: string,
  url: string,
  params?: any,
  options?: { 
    skipCache?: boolean;
    forceRefresh?: boolean;
    timeout?: number;
  }
): Promise<T> => {
  const cacheKey = ApiCache.generateKey(method, url, params); // ✅ Now using static method
  
  // Check for duplicate pending requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey) as Promise<T>;
  }
  
  // Check cache if not forcing refresh
  if (method.toLowerCase() === 'get' && !options?.skipCache && !options?.forceRefresh) {
    const cachedData = ApiCache.get(cacheKey);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
  }
  
  // Make the request
  const requestPromise = (async () => {
    try {
      const config = {
        method,
        url,
        params: method.toLowerCase() === 'get' ? params : undefined,
        data: method.toLowerCase() === 'post' || method.toLowerCase() === 'put' ? params : undefined,
        timeout: options?.timeout || 10000
      };
      
      const response = await api(config);
      return response.data;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();
  
  // Store in pending requests
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
};

// Regular (non-batched) API methods for backward compatibility
const transactionAPIBase = {
  // Get transactions with caching
  getTransactions: (monthYear?: string) => {
    const url = '/transactions';
    const params = monthYear ? { monthYear } : undefined;
    return cachedRequest<Transaction[]>('get', url, params, { 
      forceRefresh: false
    });    
  },
  
  // Create transaction (clears related cache)
  createTransaction: (transaction: Omit<Transaction, '_id' | 'monthYear'>) => {
    // Clear cache before making request
    ApiCache.deleteByPattern(/transactions/);
    return cachedRequest<Transaction>('post', '/transactions', transaction, { skipCache: true });
  },
  
  // Get monthly summary with caching
  getMonthlySummary: (monthYear: string) => {
    const url = `/transactions/summary/${monthYear}`;
    return cachedRequest<MonthlySummary>('get', url, undefined, { forceRefresh: false });
  },
  
  // Get available months with caching
  getAvailableMonths: () => {
    return cachedRequest<string[]>('get', '/transactions/months', undefined, { forceRefresh: false });
  },
  
  // Update transaction (clears related cache)
  updateTransaction: (id: string, transaction: Partial<Transaction>) => {
    // Clear cache before making request
    ApiCache.deleteByPattern(/transactions/);
    return cachedRequest<Transaction>('put', `/transactions/${id}`, transaction, { skipCache: true });
  },
  
  // Delete transaction (clears related cache)
  deleteTransaction: (id: string) => {
    // Clear cache before making request
    ApiCache.deleteByPattern(/transactions/);
    return cachedRequest('delete', `/transactions/${id}`, undefined, { skipCache: true });
  },
  
  // Download Excel (no caching)
  downloadExcelReport: () => {
    return api.get('/transactions/download-excel', {
      responseType: 'blob',
      timeout: 30000 // 30 seconds for file download
    });
  }
};

// Batched API methods (for components that need batching)
const transactionAPIBatched = {
  // Get transactions with batching
  getTransactionsBatched: async (monthYear?: string) => {
    const batchKey = `transactions-${monthYear || 'all'}`;
    return batcher.batchRequest(batchKey, () => 
      transactionAPIBase.getTransactions(monthYear)
    );
  },
  
  // Get monthly summary with batching
  getMonthlySummaryBatched: async (monthYear: string) => {
    const batchKey = `summary-${monthYear}`;
    return batcher.batchRequest(batchKey, () =>
      transactionAPIBase.getMonthlySummary(monthYear)
    );
  },
  
  // Get available months with batching
  getAvailableMonthsBatched: async () => {
    const batchKey = 'available-months';
    return batcher.batchRequest(batchKey, () =>
      transactionAPIBase.getAvailableMonths()
    );
  }
};

// Combine both APIs
export const transactionAPI = {
  ...transactionAPIBase,
  ...transactionAPIBatched
};

export const authAPI = {
  register: (userData: { name: string; email: string; password: string }) =>
    cachedRequest('post', '/auth/register', userData, { skipCache: true }),
  
  login: (credentials: { email: string; password: string }) =>
    cachedRequest('post', '/auth/login', credentials, { skipCache: true }),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    cachedRequest('post', '/auth/change-password', data, { skipCache: true }),

  forgotPassword: (email: string) =>
    cachedRequest('post', '/auth/forgot-password', { email }, { skipCache: true }),
  
  resetPassword: (token: string, password: string) =>
    cachedRequest('post', `/auth/reset-password/${token}`, { password }, { skipCache: true }),
};

// Export utility functions for cache management
export const cacheUtils = {
  clearTransactionCache: () => {
    ApiCache.deleteByPattern(/transactions/);
  },
  
  clearAllCache: () => {
    ApiCache.clear();
  },
  
  getCacheStats: () => {
    const cacheInstance = ApiCache as any;
    return {
      size: cacheInstance.cache?.size || 0,
      keys: Array.from(cacheInstance.cache?.keys() || [])
    };
  }
};



// src/services/api.ts - Add lending API methods
export const lendingAPI = {
  // Get all lendings
  getLendings: (params?: { type?: string; status?: string }) => 
    cachedRequest('get', '/lendings', params, { forceRefresh: false }),
  
  // Get statistics
  getStatistics: () => 
    cachedRequest('get', '/lendings/statistics', undefined, { forceRefresh: false }),
  
  // Create lending
  createLending: (data: any) => 
    cachedRequest('post', '/lendings', data, { skipCache: true }),
  
  // Update lending
  updateLending: (id: string, data: any) => 
    cachedRequest('put', `/lendings/${id}`, data, { skipCache: true }),
  
  // Update status
  // Update status - TEMPORARY: Bypass cache
  updateStatus: async (id: string, status: string) => {
        const response = await api.patch(`/lendings/${id}/status`, { status });
    return response;
  },
  
  // Delete lending
  deleteLending: (id: string) => 
    cachedRequest('delete', `/lendings/${id}`, undefined, { skipCache: true })
};

export default api;