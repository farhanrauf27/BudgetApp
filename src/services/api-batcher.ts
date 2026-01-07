// src/services/api-batcher.ts
class RequestBatcher {
  private batchQueue = new Map<string, Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>>();
  
  private batchTimeout = 50; // ms
  private batchTimer: NodeJS.Timeout | null = null;

  async batchRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batchQueue.has(key)) {
        this.batchQueue.set(key, []);
      }
      
      this.batchQueue.get(key)!.push({ resolve, reject });
      
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(key, requestFn), this.batchTimeout);
      }
    });
  }

  private async processBatch<T>(key: string, requestFn: () => Promise<T>) {
    const batch = this.batchQueue.get(key);
    if (!batch || batch.length === 0) return;

    this.batchQueue.delete(key);
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const result = await requestFn();
      batch.forEach(({ resolve }) => resolve(result));
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }
}

export default new RequestBatcher();