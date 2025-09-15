/**
 * Comprehensive Rate Limiting and Request Management System
 *
 * This module provides:
 * - Request throttling and queuing
 * - Exponential backoff retry logic
 * - Circuit breaker pattern for failed endpoints
 * - Request deduplication
 * - Intelligent caching
 * - 429 error handling with proper delays
 */

import { apiMonitor } from './apiMonitor';

interface RequestConfig {
  url: string;
  options: RequestInit;
  retryCount?: number;
  priority?: 'high' | 'medium' | 'low';
  cacheKey?: string;
  cacheTTL?: number; // Time to live in milliseconds
}

interface QueuedRequest {
  id: string;
  config: RequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class RateLimiter {
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = new Set<string>();
  private inflightWaiters = new Map<string, Array<{ resolve: (value: any) => void; reject: (error: any) => void }>>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private cache = new Map<string, CacheEntry>();
  private suppressedCache = new Map<string, number>(); // pattern -> until timestamp
  private requestHistory: number[] = [];
  private isProcessing = false;
  
  // Configuration
  private readonly MAX_CONCURRENT_REQUESTS = 3;
  private readonly MAX_REQUESTS_PER_MINUTE = 20;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  
  constructor() {
    // Start processing queue
    this.startQueueProcessor();
    
    // Clean up old request history every minute
    setInterval(() => {
      const now = Date.now();
      this.requestHistory = this.requestHistory.filter(
        timestamp => now - timestamp < this.RATE_LIMIT_WINDOW
      );
      this.cleanupCache();
    }, 60000);
  }

  /**
   * Main method to make rate-limited requests
   */
  async makeRequest<T>(config: RequestConfig): Promise<T> {
    const requestId = this.generateRequestId(config);
    
    // Check cache first
    if (config.cacheKey) {
      const cached = this.getFromCache(config.cacheKey);
      if (cached) {
        console.log('🎯 Cache hit for:', config.cacheKey);
        
        // Record cache hit
        apiMonitor.recordRequest(
          config.url,
          config.options.method || 'GET',
          Date.now(),
          200,
          undefined,
          0,
          true
        );
        
        return cached;
      }
    }
    
    // Check circuit breaker
    const endpoint = this.getEndpointFromUrl(config.url);
    if (this.isCircuitBreakerOpen(endpoint)) {
      throw new Error(`Circuit breaker is open for endpoint: ${endpoint}. Service temporarily unavailable.`);
    }
    
    // Check for duplicate requests (only for GET requests to prevent blocking user actions)
    if (config.options.method === 'GET' && this.activeRequests.has(requestId)) {
      console.log('🔄 Duplicate GET request detected, waiting for existing request:', requestId);
      return this.waitForExistingRequest<T>(requestId, config.cacheKey);
    }
    
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        config,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: config.retryCount || 0
      };
      
      // Add to queue with priority
      this.addToQueue(queuedRequest);
    });
  }

  /**
   * Add request to queue with priority ordering
   */
  private addToQueue(request: QueuedRequest): void {
    const priority = request.config.priority || 'medium';
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    // Insert based on priority and timestamp
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedPriority = this.requestQueue[i].config.priority || 'medium';
      if (priorityOrder[priority] > priorityOrder[queuedPriority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
    console.log(`📋 Added request to queue (position ${insertIndex + 1}/${this.requestQueue.length}):`, request.config.url);
  }

  /**
   * Process the request queue
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.requestQueue.length === 0) {
        return;
      }
      
      // Check if we can make more requests
      if (this.activeRequests.size >= this.MAX_CONCURRENT_REQUESTS) {
        return;
      }
      
      // Check rate limiting
      if (!this.canMakeRequest()) {
        console.log('⏳ Rate limit reached, waiting...');
        return;
      }
      
      const request = this.requestQueue.shift();
      
      if (request) {
        // Process request without blocking the queue processor
        this.processRequest(request).catch(error => {
          console.error('❌ Error processing queued request:', error);
          request.reject(error);
        });
      }
    }, 100); // Check every 100ms
  }

  /**
   * Process individual request with error handling and retries
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const { id, config, resolve, reject } = request;
    const startTime = Date.now();
    
    try {
      this.activeRequests.add(id);
      
      console.log(`🚀 Processing request: ${config.url}`);
      
      // Record request timestamp for rate limiting
      this.requestHistory.push(Date.now());
      
      const response = await fetch(config.url, config.options);
      
      // Handle 429 specifically with proper JSON parsing
      if (response.status === 429) {
        console.log('⚠️ Rate limited (429), implementing exponential backoff');
        
        // Try to get retry-after header
        const retryAfter = response.headers.get('retry-after');
        const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : this.calculateExponentialBackoff(request.retryCount);
        
        this.handleRateLimitedRequest(request, retryDelay);
        return;
      }
      
      // Handle other HTTP errors
      if (!response.ok) {
        const endpoint = this.getEndpointFromUrl(config.url);
        
        // Only record failure for server errors (5xx) and some 4xx errors
        // Don't record failure for client errors like 409 (Conflict) that shouldn't trigger circuit breaker
        const shouldRecordFailure = response.status >= 500 ||
          (response.status >= 400 && response.status !== 409 && response.status !== 400 && response.status !== 404);
        
        if (shouldRecordFailure) {
          this.recordFailure(endpoint);
        }
        
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          // Try to parse JSON error response
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // Handle plain text error responses (common with 429 errors)
            const errorText = await response.text();
            if (errorText && errorText.length < 200) { // Reasonable error message length
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          // Use status-based message as fallback
          if (response.status === 401) {
            errorMessage = 'Authentication required';
          } else if (response.status === 403) {
            errorMessage = 'Access denied';
          } else if (response.status === 404) {
            errorMessage = 'Resource not found';
          } else if (response.status === 409) {
            errorMessage = 'Conflict - resource already exists or is in use';
          } else if (response.status >= 500) {
            errorMessage = 'Internal server error';
          }
        }
        
        // Create error with status code for better handling upstream
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.statusCode = response.status;
        throw error;
      }
      
      // Success - reset circuit breaker
      const endpoint = this.getEndpointFromUrl(config.url);
      this.recordSuccess(endpoint);
      
      const data = await response.json();
      
      // Cache successful responses
      if (config.cacheKey && config.cacheTTL) {
        this.setCache(config.cacheKey, data, config.cacheTTL);
      }

      // Record successful request
      apiMonitor.recordRequest(
        config.url,
        config.options.method || 'GET',
        startTime,
        response.status,
        undefined,
        request.retryCount
      );
      
      resolve(data);
      // Notify any waiters for this in-flight request
      const waiters = this.inflightWaiters.get(id);
      if (waiters && waiters.length > 0) {
        waiters.forEach(w => {
          try { w.resolve(data); } catch {}
        });
        this.inflightWaiters.delete(id);
      }
      
    } catch (error) {
      console.error(`❌ Request failed: ${config.url}`, error);
      
      // Record failed request
      const errorMessage = error instanceof Error ? error.message : String(error);
      apiMonitor.recordRequest(
        config.url,
        config.options.method || 'GET',
        startTime,
        errorMessage.includes('429') ? 429 : 500,
        errorMessage,
        request.retryCount
      );

      // Check if we should retry
      if (request.retryCount < this.MAX_RETRY_ATTEMPTS && this.shouldRetry(error)) {
        this.retryRequest(request);
      } else {
        const endpoint = this.getEndpointFromUrl(config.url);
        this.recordFailure(endpoint);
        reject(error);
        // Propagate error to any waiters
        const waiters = this.inflightWaiters.get(id);
        if (waiters && waiters.length > 0) {
          waiters.forEach(w => {
            try { w.reject(error); } catch {}
          });
          this.inflightWaiters.delete(id);
        }
      }
    } finally {
      this.activeRequests.delete(id);
    }
  }

  /**
   * Handle rate limited requests with exponential backoff
   */
  private handleRateLimitedRequest(request: QueuedRequest, customDelay?: number): void {
    const delay = customDelay || this.calculateExponentialBackoff(request.retryCount);
    
    console.log(`⏰ Rate limited, retrying in ${delay}ms (attempt ${request.retryCount + 1})`);
    
    setTimeout(() => {
      request.retryCount++;
      this.addToQueue(request);
    }, delay);
  }

  /**
   * Retry failed requests with exponential backoff
   */
  private retryRequest(request: QueuedRequest): void {
    const delay = this.calculateExponentialBackoff(request.retryCount);
    
    console.log(`🔄 Retrying request in ${delay}ms (attempt ${request.retryCount + 1}):`, request.config.url);
    
    setTimeout(() => {
      request.retryCount++;
      this.addToQueue(request);
    }, delay);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateExponentialBackoff(retryCount: number): number {
    const baseDelay = this.DEFAULT_RETRY_DELAY;
    const maxDelay = 30000; // 30 seconds max
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    
    const delay = Math.min(baseDelay * Math.pow(2, retryCount) + jitter, maxDelay);
    return Math.floor(delay);
  }

  /**
   * Check if we can make a new request based on rate limits
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(
      timestamp => now - timestamp < this.RATE_LIMIT_WINDOW
    );
    
    return recentRequests.length < this.MAX_REQUESTS_PER_MINUTE;
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    // Don't retry client errors that indicate user/data issues
    if (error.status === 409 || error.statusCode === 409) return false; // Conflict - duplicate invitation
    if (error.status === 400 || error.statusCode === 400) return false; // Bad request
    if (error.status === 401 || error.statusCode === 401) return false; // Unauthorized
    if (error.status === 403 || error.statusCode === 403) return false; // Forbidden
    if (error.status === 404 || error.statusCode === 404) return false; // Not found
    
    // Retry these errors
    if (error.message?.includes('429')) return true; // Rate limited
    if (error.message?.includes('Network error')) return true; // Network issues
    if (error.message?.includes('fetch')) return true; // Fetch failures
    if (error.message?.includes('Internal server error')) return true; // Server errors
    if (error.status >= 500 || error.statusCode >= 500) return true; // Server errors
    
    return false;
  }

  /**
   * Circuit breaker implementation
   */
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const breaker = this.circuitBreakers.get(endpoint);
    if (!breaker) return false;
    
    const now = Date.now();
    
    if (breaker.state === 'open') {
      if (now > breaker.nextAttempt) {
        // Transition to half-open
        breaker.state = 'half-open';
        console.log(`🔄 Circuit breaker half-open for: ${endpoint}`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  private recordFailure(endpoint: string): void {
    const now = Date.now();
    let breaker = this.circuitBreakers.get(endpoint);
    
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        nextAttempt: 0
      };
      this.circuitBreakers.set(endpoint, breaker);
    }
    
    breaker.failures++;
    breaker.lastFailure = now;
    
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      breaker.nextAttempt = now + this.CIRCUIT_BREAKER_TIMEOUT;
      console.log(`🚫 Circuit breaker opened for: ${endpoint} (${breaker.failures} failures)`);
    }
  }

  private recordSuccess(endpoint: string): void {
    const breaker = this.circuitBreakers.get(endpoint);
    if (breaker) {
      if (breaker.state === 'half-open') {
        // Transition back to closed
        breaker.state = 'closed';
        breaker.failures = 0;
        console.log(`✅ Circuit breaker closed for: ${endpoint}`);
      } else if (breaker.state === 'closed') {
        // Reset failure count on successful request
        breaker.failures = Math.max(0, breaker.failures - 1);
      }
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    // Check suppression patterns to avoid caching stale responses after invalidation
    for (const [pattern, until] of this.suppressedCache.entries()) {
      if (key.includes(pattern)) {
        if (Date.now() < until) {
          console.log('🚫 Cache set suppressed for key due to recent invalidation:', key);
          return;
        } else {
          this.suppressedCache.delete(pattern);
        }
      }
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Request deduplication
   */
  private generateRequestId(config: RequestConfig): string {
    const method = config.options.method || 'GET';
    const body = config.options.body || '';
    return `${method}:${config.url}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
  }

  private async waitForExistingRequest<T>(requestId: string, cacheKey?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        // When the original request finishes
        if (!this.activeRequests.has(requestId)) {
          clearInterval(interval);
          // If we have a cacheKey, try to return the freshly cached data
          if (cacheKey) {
            const tryReturnCache = () => {
              const cached = this.getFromCache(cacheKey);
              if (cached) return resolve(cached as T);
              return null;
            };
            // Try immediately, then poll briefly for cache population
            if (tryReturnCache()) return;
            let attempts = 0;
            const poll = setInterval(() => {
              attempts++;
              if (tryReturnCache() || attempts > 20) { // up to ~2s
                clearInterval(poll);
                if (attempts > 20) {
                  return reject(new Error('Duplicate request completed; cache not populated'));
                }
              }
            }, 100);
            return;
          }
          // If no cache available, signal to retry gracefully
          return reject(new Error('Duplicate request completed; result unavailable'));
        }
        // Safety timeout after 30s
        if (Date.now() - start > 30000) {
          clearInterval(interval);
          return reject(new Error('Timeout waiting for duplicate request'));
        }
      }, 100);

      // Also register as a waiter to get the original response directly
      if (!this.inflightWaiters.has(requestId)) {
        this.inflightWaiters.set(requestId, []);
      }
      this.inflightWaiters.get(requestId)!.push({ resolve, reject });
    });
  }

  /**
   * Utility methods
   */
  private getEndpointFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  /**
   * Temporarily suppress caching for cache keys containing the given pattern
   */
  suppressCacheFor(pattern: string, ms: number): void {
    const until = Date.now() + ms;
    this.suppressedCache.set(pattern, until);
    console.log(`🛡️ Suppressing cache sets for pattern '${pattern}' for ${ms}ms`);
  }

  /**
   * Get current status for debugging
   */
  getStatus() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      recentRequestCount: this.requestHistory.length,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear all caches and reset state
   */
  reset(): void {
    this.requestQueue.length = 0;
    this.activeRequests.clear();
    this.circuitBreakers.clear();
    this.cache.clear();
    this.requestHistory.length = 0;
    console.log('🔄 Rate limiter reset');
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Enhanced fetch wrapper with rate limiting
 */
export async function rateLimitedFetch<T>(
  url: string,
  options: RequestInit = {},
  config: {
    priority?: 'high' | 'medium' | 'low';
    cacheKey?: string;
    cacheTTL?: number;
    maxRetries?: number;
  } = {}
): Promise<T> {
  const requestConfig: RequestConfig = {
    url,
    options,
    priority: config.priority || 'medium',
    cacheKey: config.cacheKey,
    cacheTTL: config.cacheTTL || 300000, // 5 minutes default
    retryCount: 0
  };

  return rateLimiter.makeRequest<T>(requestConfig);
}

/**
 * Specialized methods for common use cases
 */
export const RateLimitedAPI = {
  /**
   * High priority request (for user actions)
   */
  urgent: <T>(url: string, options: RequestInit = {}) =>
    rateLimitedFetch<T>(url, options, { priority: 'high' }),

  /**
   * Cached GET request
   */
  cached: <T>(url: string, cacheKey: string, cacheTTL: number = 300000) =>
    rateLimitedFetch<T>(url, { method: 'GET' }, { cacheKey, cacheTTL }),

  /**
   * Background request (low priority)
   */
  background: <T>(url: string, options: RequestInit = {}) =>
    rateLimitedFetch<T>(url, options, { priority: 'low' }),

  /**
   * Get rate limiter status
   */
  getStatus: () => rateLimiter.getStatus(),

  /**
   * Reset rate limiter
   */
  reset: () => rateLimiter.reset(),

  /**
   * Clear specific cache entries
   */
  clearCache: (keyPattern?: string) => {
    if (keyPattern) {
      // Clear cache entries matching pattern
      for (const [key] of rateLimiter['cache'].entries()) {
        if (key.includes(keyPattern)) {
          rateLimiter['cache'].delete(key);
          console.log('🗑️ Cleared cache entry:', key);
        }
      }
    } else {
      // Clear all cache
      rateLimiter['cache'].clear();
      console.log('🗑️ Cleared all cache entries');
    }
  }
};

// Add global debug helper
if (typeof window !== 'undefined') {
  (window as any).rateLimiterStatus = () => {
    console.log('📊 Rate Limiter Status:', RateLimitedAPI.getStatus());
  };
  
  (window as any).resetRateLimiter = () => {
    RateLimitedAPI.reset();
    console.log('🔄 Rate limiter reset');
  };
}