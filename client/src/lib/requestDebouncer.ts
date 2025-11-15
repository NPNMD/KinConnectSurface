/**
 * Request Debouncing and Coordination Utility
 * 
 * This module provides:
 * - Request debouncing to prevent rapid successive calls
 * - Request coordination to batch similar requests
 * - Smart refresh management
 */

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
  cancel: () => void;
  flush: () => Promise<ReturnType<T> | undefined>;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: any) => void;
  args: any[];
  timestamp: number;
}

class RequestDebouncer {
  private pendingRequests = new Map<string, PendingRequest<any>[]>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private lastRequestTimes = new Map<string, number>();
  
  /**
   * Debounce a function to prevent rapid successive calls
   */
  debounce<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delay: number,
    key?: string
  ): DebouncedFunction<T> {
    const debounceKey = key || fn.name || 'default';
    
    const debouncedFn = (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve, reject) => {
        // Clear existing timer
        const existingTimer = this.debounceTimers.get(debounceKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // Add to pending requests
        if (!this.pendingRequests.has(debounceKey)) {
          this.pendingRequests.set(debounceKey, []);
        }
        
        this.pendingRequests.get(debounceKey)!.push({
          resolve,
          reject,
          args,
          timestamp: Date.now()
        });
        
        // Set new timer
        const timer = setTimeout(async () => {
          const requests = this.pendingRequests.get(debounceKey) || [];
          this.pendingRequests.delete(debounceKey);
          this.debounceTimers.delete(debounceKey);
          
          if (requests.length === 0) return;
          
          try {
            // Use the most recent request's arguments
            const latestRequest = requests[requests.length - 1];
            console.log(`🔄 Executing debounced request: ${debounceKey} (${requests.length} calls batched)`);
            
            const result = await fn(...latestRequest.args);
            
            // Resolve all pending requests with the same result
            requests.forEach(req => req.resolve(result));
            
            // Record successful request time
            this.lastRequestTimes.set(debounceKey, Date.now());
            
          } catch (error) {
            console.error(`❌ Debounced request failed: ${debounceKey}`, error);
            // Reject all pending requests
            requests.forEach(req => req.reject(error));
          }
        }, delay);
        
        this.debounceTimers.set(debounceKey, timer);
      });
    };
    
    debouncedFn.cancel = () => {
      const timer = this.debounceTimers.get(debounceKey);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(debounceKey);
      }
      
      const requests = this.pendingRequests.get(debounceKey) || [];
      this.pendingRequests.delete(debounceKey);
      
      // Reject all pending requests
      requests.forEach(req => req.reject(new Error('Request cancelled')));
    };
    
    debouncedFn.flush = async (): Promise<ReturnType<T> | undefined> => {
      const timer = this.debounceTimers.get(debounceKey);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(debounceKey);
      }
      
      const requests = this.pendingRequests.get(debounceKey) || [];
      this.pendingRequests.delete(debounceKey);
      
      if (requests.length === 0) return undefined;
      
      try {
        const latestRequest = requests[requests.length - 1];
        const result = await fn(...latestRequest.args);
        
        requests.forEach(req => req.resolve(result));
        this.lastRequestTimes.set(debounceKey, Date.now());
        
        return result;
      } catch (error) {
        requests.forEach(req => req.reject(error));
        throw error;
      }
    };
    
    return debouncedFn;
  }

  /**
   * Throttle a function to limit how often it can be called
   */
  throttle<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    limit: number,
    key?: string
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | null> {
    const throttleKey = key || fn.name || 'default';
    
    return async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
      const now = Date.now();
      const lastCall = this.lastRequestTimes.get(throttleKey) || 0;
      
      if (now - lastCall < limit) {
        console.log(`⏳ Throttled request: ${throttleKey} (${now - lastCall}ms since last call)`);
        return null;
      }
      
      this.lastRequestTimes.set(throttleKey, now);
      return await fn(...args);
    };
  }

  /**
   * Smart refresh that prevents excessive API calls
   */
  smartRefresh<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    minInterval: number = 30000, // 30 seconds minimum
    key?: string
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | null> {
    const refreshKey = key || fn.name || 'default';
    
    return async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
      const now = Date.now();
      const lastRefresh = this.lastRequestTimes.get(refreshKey) || 0;
      
      // If we've refreshed recently, skip
      if (now - lastRefresh < minInterval) {
        console.log(`🚫 Skipping refresh: ${refreshKey} (${Math.round((now - lastRefresh) / 1000)}s since last refresh)`);
        return null;
      }
      
      console.log(`🔄 Smart refresh: ${refreshKey}`);
      this.lastRequestTimes.set(refreshKey, now);
      return await fn(...args);
    };
  }

  /**
   * Smart refresh with mount-aware cache bypassing
   * This version can bypass cache on component mount to fix navigation issues
   */
  smartRefreshWithMount<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    minInterval: number = 30000, // 30 seconds minimum
    key?: string
  ): (bypassCache?: boolean, ...args: Parameters<T>) => Promise<ReturnType<T> | null> {
    const refreshKey = key || fn.name || 'default';
    
    return async (bypassCache: boolean = false, ...args: Parameters<T>): Promise<ReturnType<T> | null> => {
      const now = Date.now();
      const lastRefresh = this.lastRequestTimes.get(refreshKey) || 0;
      
      // If bypassCache is true, skip the cache check and make fresh API call
      if (bypassCache) {
        console.log(`🔄 Smart refresh with cache bypass: ${refreshKey} (mount-aware refresh)`);
        this.lastRequestTimes.set(refreshKey, now);
        return await fn(...args);
      }
      
      // Normal cache behavior - if we've refreshed recently, skip
      if (now - lastRefresh < minInterval) {
        console.log(`🚫 Skipping refresh: ${refreshKey} (${Math.round((now - lastRefresh) / 1000)}s since last refresh)`);
        return null;
      }
      
      console.log(`🔄 Smart refresh: ${refreshKey}`);
      this.lastRequestTimes.set(refreshKey, now);
      return await fn(...args);
    };
  }

  /**
   * Get status for debugging
   */
  getStatus() {
    return {
      pendingRequests: Object.fromEntries(
        Array.from(this.pendingRequests.entries()).map(([key, requests]) => [
          key,
          requests.length
        ])
      ),
      activeTimers: this.debounceTimers.size,
      lastRequestTimes: Object.fromEntries(this.lastRequestTimes)
    };
  }

  /**
   * Clear cache for a specific key (reset last request time)
   * This allows forcing a fresh fetch even if within the minInterval
   */
  clearCache(key?: string): void {
    if (key) {
      this.lastRequestTimes.delete(key);
      console.log(`🔄 Cache cleared for key: ${key}`);
    } else {
      this.lastRequestTimes.clear();
      console.log('🔄 All cache cleared');
    }
  }

  /**
   * Clear all pending requests and timers
   */
  reset(): void {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Reject all pending requests
    this.pendingRequests.forEach(requests => {
      requests.forEach(req => req.reject(new Error('Debouncer reset')));
    });
    this.pendingRequests.clear();
    
    this.lastRequestTimes.clear();
    console.log('🔄 Request debouncer reset');
  }
}

// Create singleton instance
export const requestDebouncer = new RequestDebouncer();

/**
 * Convenience functions for common debouncing patterns
 */
export const createDebouncedFunction = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number,
  key?: string
) => requestDebouncer.debounce(fn, delay, key);

export const createThrottledFunction = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number,
  key?: string
) => requestDebouncer.throttle(fn, limit, key);

export const createSmartRefresh = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  minInterval?: number,
  key?: string
) => requestDebouncer.smartRefresh(fn, minInterval, key);

export const createSmartRefreshWithMount = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  minInterval?: number,
  key?: string
) => requestDebouncer.smartRefreshWithMount(fn, minInterval, key);

// Export clearCache function for convenience
export const clearRequestCache = (key?: string) => {
  requestDebouncer.clearCache(key);
};

// Add global debug helper
if (typeof window !== 'undefined') {
  (window as any).debouncerStatus = () => {
    console.log('📊 Request Debouncer Status:', requestDebouncer.getStatus());
  };
  
  (window as any).resetDebouncer = () => {
    requestDebouncer.reset();
    console.log('🔄 Request debouncer reset');
  };

  (window as any).clearRequestCache = clearRequestCache;
}