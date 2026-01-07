// src/services/cache.ts
class DataCache {
  private static instance: DataCache;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private currentUserId: string | null = null;
  private USER_KEY_PREFIX = 'user_cache_';

  private constructor() {}

  static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance;
  }

  // Set current user ID for cache isolation
  setUserId(userId: string): void {
    if (this.currentUserId !== userId) {
      // Clear cache when switching users
      this.clear();
      this.currentUserId = userId;
      console.log(`Cache: User switched to ${userId}`);
    }
  }

  // Clear current user cache
  clearCurrentUserCache(): void {
    if (this.currentUserId) {
      const userPrefix = `${this.USER_KEY_PREFIX}${this.currentUserId}_`;
      const keysToDelete: string[] = [];
      
      this.cache.forEach((value, key) => {
        if (key.startsWith(userPrefix)) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`Cache: Cleared data for user ${this.currentUserId}`);
    }
    this.currentUserId = null;
  }

  // Generate user-specific cache key
  private generateUserKey(key: string): string {
    if (!this.currentUserId) {
      console.warn('Cache: No user ID set, using generic key');
      return key;
    }
    return `${this.USER_KEY_PREFIX}${this.currentUserId}_${key}`;
  }

  set(key: string, data: any): void {
    const userKey = this.generateUserKey(key);
    this.cache.set(userKey, {
      data,
      timestamp: Date.now()
    });
    console.log(`Cache: Set ${userKey}`);
  }

  get(key: string): any | null {
    const userKey = this.generateUserKey(key);
    const cached = this.cache.get(userKey);
    
    if (!cached) {
      console.log(`Cache: Miss ${userKey}`);
      return null;
    }
    
    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(userKey);
      console.log(`Cache: Expired ${userKey}`);
      return null;
    }
    
    console.log(`Cache: Hit ${userKey}`);
    return cached.data;
  }

  delete(key: string): void {
    const userKey = this.generateUserKey(key);
    this.cache.delete(userKey);
    console.log(`Cache: Deleted ${userKey}`);
  }

  clear(): void {
    this.cache.clear();
    console.log('Cache: Cleared all in-memory cache');
  }

  // Debug methods
  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheContents(): Array<{key: string, data: any, timestamp: number}> {
    return Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      data: value.data,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp
    }));
  }

  // Helper methods to generate cache keys
  generateTransactionsKey(month?: string): string {
    return month ? `transactions-${month}` : 'transactions-all';
  }
  
  generateSummaryKey(month: string): string {
    return `summary-${month}`;
  }
  
  generateMonthsKey(): string {
    return 'available-months';
  }
}

export default DataCache.getInstance();