/**
 * API Request Monitoring and Debugging Utility
 * 
 * This module provides:
 * - Request tracking and analytics
 * - Performance monitoring
 * - Error tracking and reporting
 * - Rate limiting metrics
 */

interface RequestMetrics {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
  retryCount?: number;
  fromCache?: boolean;
}

interface EndpointStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageResponseTime: number;
  lastRequest: number;
  errors: string[];
}

class APIMonitor {
  private metrics: RequestMetrics[] = [];
  private endpointStats = new Map<string, EndpointStats>();
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly STATS_RETENTION_TIME = 3600000; // 1 hour

  constructor() {
    // Clean up old metrics every 10 minutes
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 600000);

    // Add global debug helpers
    if (typeof window !== 'undefined') {
      (window as any).apiMonitorStatus = () => this.getDetailedStatus();
      (window as any).clearApiMonitor = () => this.reset();
      (window as any).getApiStats = () => this.getEndpointStats();
    }
  }

  /**
   * Record a request attempt
   */
  recordRequest(
    url: string,
    method: string,
    startTime: number,
    status: number,
    error?: string,
    retryCount?: number,
    fromCache?: boolean
  ): void {
    const duration = Date.now() - startTime;
    const endpoint = this.getEndpointFromUrl(url);

    const metric: RequestMetrics = {
      url,
      method,
      status,
      duration,
      timestamp: Date.now(),
      error,
      retryCount,
      fromCache
    };

    this.metrics.push(metric);

    // Trim metrics if we have too many
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }

    // Update endpoint stats
    this.updateEndpointStats(endpoint, metric);

    // Log significant events
    if (status === 429) {
      console.warn(`⚠️ Rate limited: ${method} ${url} (attempt ${retryCount || 1})`);
    } else if (status >= 500) {
      console.error(`❌ Server error: ${method} ${url} - ${status} ${error || ''}`);
    } else if (fromCache) {
      console.log(`🎯 Cache hit: ${method} ${url}`);
    }
  }

  /**
   * Update endpoint statistics
   */
  private updateEndpointStats(endpoint: string, metric: RequestMetrics): void {
    let stats = this.endpointStats.get(endpoint);
    
    if (!stats) {
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimitedRequests: 0,
        averageResponseTime: 0,
        lastRequest: 0,
        errors: []
      };
      this.endpointStats.set(endpoint, stats);
    }

    stats.totalRequests++;
    stats.lastRequest = metric.timestamp;

    if (metric.status === 429) {
      stats.rateLimitedRequests++;
    } else if (metric.status >= 200 && metric.status < 300) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
      if (metric.error && !stats.errors.includes(metric.error)) {
        stats.errors.push(metric.error);
        // Keep only last 5 unique errors
        if (stats.errors.length > 5) {
          stats.errors = stats.errors.slice(-5);
        }
      }
    }

    // Update average response time
    const recentMetrics = this.metrics
      .filter(m => m.url.includes(endpoint) && m.timestamp > Date.now() - 300000) // Last 5 minutes
      .filter(m => m.status >= 200 && m.status < 300); // Only successful requests

    if (recentMetrics.length > 0) {
      stats.averageResponseTime = Math.round(
        recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      );
    }
  }

  /**
   * Get endpoint statistics
   */
  getEndpointStats(): Record<string, EndpointStats> {
    return Object.fromEntries(this.endpointStats);
  }

  /**
   * Get detailed monitoring status
   */
  getDetailedStatus() {
    const now = Date.now();
    const last5Minutes = this.metrics.filter(m => now - m.timestamp < 300000);
    const last1Minute = this.metrics.filter(m => now - m.timestamp < 60000);

    const rateLimitedRequests = last5Minutes.filter(m => m.status === 429);
    const failedRequests = last5Minutes.filter(m => m.status >= 400);
    const successfulRequests = last5Minutes.filter(m => m.status >= 200 && m.status < 300);

    return {
      summary: {
        totalMetrics: this.metrics.length,
        endpointsTracked: this.endpointStats.size,
        last5Minutes: {
          total: last5Minutes.length,
          successful: successfulRequests.length,
          failed: failedRequests.length,
          rateLimited: rateLimitedRequests.length,
          successRate: last5Minutes.length > 0 ? Math.round((successfulRequests.length / last5Minutes.length) * 100) : 0
        },
        last1Minute: {
          total: last1Minute.length,
          rateLimited: last1Minute.filter(m => m.status === 429).length
        }
      },
      recentErrors: this.getRecentErrors(),
      endpointStats: this.getEndpointStats(),
      rateLimitingEvents: rateLimitedRequests.map(m => ({
        url: m.url,
        timestamp: new Date(m.timestamp).toISOString(),
        retryCount: m.retryCount
      }))
    };
  }

  /**
   * Get recent errors for debugging
   */
  private getRecentErrors(): Array<{ url: string; error: string; timestamp: string; count: number }> {
    const now = Date.now();
    const recentErrors = this.metrics
      .filter(m => m.error && now - m.timestamp < 300000) // Last 5 minutes
      .reduce((acc, metric) => {
        const key = `${metric.url}:${metric.error}`;
        if (!acc[key]) {
          acc[key] = {
            url: metric.url,
            error: metric.error!,
            timestamp: new Date(metric.timestamp).toISOString(),
            count: 0
          };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, any>);

    return Object.values(recentErrors)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10); // Top 10 errors
  }

  /**
   * Check if an endpoint is experiencing issues
   */
  isEndpointHealthy(endpoint: string): boolean {
    const stats = this.endpointStats.get(endpoint);
    if (!stats) return true;

    const now = Date.now();
    const recentMetrics = this.metrics
      .filter(m => m.url.includes(endpoint) && now - m.timestamp < 300000); // Last 5 minutes

    if (recentMetrics.length === 0) return true;

    const failureRate = recentMetrics.filter(m => m.status >= 400).length / recentMetrics.length;
    const rateLimitRate = recentMetrics.filter(m => m.status === 429).length / recentMetrics.length;

    // Consider unhealthy if >50% failures or >30% rate limited
    return failureRate < 0.5 && rateLimitRate < 0.3;
  }

  /**
   * Get recommended action for an endpoint
   */
  getEndpointRecommendation(endpoint: string): string {
    const stats = this.endpointStats.get(endpoint);
    if (!stats) return 'No data available';

    if (stats.rateLimitedRequests > stats.successfulRequests) {
      return 'High rate limiting - consider reducing request frequency';
    }

    if (stats.failedRequests > stats.successfulRequests) {
      return 'High failure rate - check endpoint health';
    }

    if (stats.averageResponseTime > 5000) {
      return 'Slow response times - consider caching';
    }

    return 'Endpoint performing well';
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.STATS_RETENTION_TIME;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    console.log(`🧹 Cleaned up old metrics, ${this.metrics.length} metrics retained`);
  }

  /**
   * Extract endpoint from URL
   */
  private getEndpointFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove query parameters and IDs for grouping
      return urlObj.pathname
        .replace(/\/[a-f0-9-]{20,}/g, '/:id') // Replace long IDs
        .replace(/\/\d+/g, '/:id'); // Replace numeric IDs
    } catch {
      return url;
    }
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.metrics.length = 0;
    this.endpointStats.clear();
    console.log('🔄 API monitor reset');
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      endpointStats: Object.fromEntries(this.endpointStats),
      exportedAt: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const apiMonitor = new APIMonitor();

/**
 * Wrapper function to monitor API requests
 */
export function monitoredFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const startTime = Date.now();
  const method = options.method || 'GET';

  return fetch(url, options)
    .then(async response => {
      const data = await response.json();
      
      apiMonitor.recordRequest(
        url,
        method,
        startTime,
        response.status,
        response.ok ? undefined : `HTTP ${response.status}`,
        0,
        false
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return data;
    })
    .catch(error => {
      apiMonitor.recordRequest(
        url,
        method,
        startTime,
        0,
        error.message,
        0,
        false
      );
      throw error;
    });
}