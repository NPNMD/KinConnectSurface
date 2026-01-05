/**
 * Performance Monitoring Service
 * 
 * Tracks performance metrics for API endpoints, database queries,
 * external API calls, and cache operations.
 */

import * as Sentry from '@sentry/node';

// Performance metric types
export interface PerformanceMetric {
  name: string;
  duration: number; // milliseconds
  timestamp: Date;
  tags?: Record<string, string | number | boolean>;
  metadata?: Record<string, any>;
}

export interface OperationTiming {
  operation: string;
  startTime: number;
  tags?: Record<string, string | number | boolean>;
}

export interface ApiMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

export interface ExternalApiMetrics {
  service: 'rxnorm' | 'rximage' | 'dailymed';
  operation: string;
  responseTime: number;
  success: boolean;
  timestamp: Date;
}

/**
 * Performance Service for tracking application performance
 */
export class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: ApiMetrics[] = [];
  private externalApiMetrics: ExternalApiMetrics[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly maxMetricsInMemory = 1000;
  private readonly aggregationIntervalMs = 60000; // 1 minute
  private aggregationTimer?: NodeJS.Timeout;

  constructor() {
    this.startAggregation();
  }

  /**
   * Start a performance timing operation
   */
  startTiming(operation: string, tags?: Record<string, string | number | boolean>): OperationTiming {
    return {
      operation,
      startTime: Date.now(),
      tags,
    };
  }

  /**
   * End a performance timing operation and record the metric
   */
  endTiming(timing: OperationTiming, metadata?: Record<string, any>): number {
    const duration = Date.now() - timing.startTime;
    
    this.recordMetric({
      name: timing.operation,
      duration,
      timestamp: new Date(),
      tags: timing.tags,
      metadata,
    });

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    tags?: Record<string, string | number | boolean>
  ): Promise<T> {
    const timing = this.startTiming(operation, tags);
    
    try {
      const result = await fn();
      const duration = this.endTiming(timing, { success: true });
      
      // Log slow operations (> 1 second)
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${operation} took ${duration}ms`, tags);
      }
      
      return result;
    } catch (error) {
      this.endTiming(timing, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    tags?: Record<string, string | number | boolean>
  ): T {
    const timing = this.startTiming(operation, tags);
    
    try {
      const result = fn();
      this.endTiming(timing, { success: true });
      return result;
    } catch (error) {
      this.endTiming(timing, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Record a generic performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Trim metrics if we exceed the limit
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }

    // Send to Sentry for performance monitoring
    try {
      const transaction = Sentry.startTransaction({
        op: metric.name,
        name: metric.name,
        tags: metric.tags,
      });
      
      transaction.setMeasurement('duration', metric.duration, 'millisecond');
      
      if (metric.metadata) {
        transaction.setContext('metadata', metric.metadata);
      }
      
      transaction.finish();
    } catch (error) {
      // Silently fail - don't let performance monitoring break the app
      console.error('Failed to send metric to Sentry:', error);
    }
  }

  /**
   * Record API endpoint metrics
   */
  recordApiMetric(metric: ApiMetrics): void {
    this.apiMetrics.push(metric);
    
    // Trim metrics if we exceed the limit
    if (this.apiMetrics.length > this.maxMetricsInMemory) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsInMemory);
    }

    // Record as generic metric for aggregation
    this.recordMetric({
      name: `api.${metric.method}.${metric.endpoint}`,
      duration: metric.responseTime,
      timestamp: metric.timestamp,
      tags: {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
      },
    });
  }

  /**
   * Record external API call metrics
   */
  recordExternalApiMetric(metric: ExternalApiMetrics): void {
    this.externalApiMetrics.push(metric);
    
    // Trim metrics if we exceed the limit
    if (this.externalApiMetrics.length > this.maxMetricsInMemory) {
      this.externalApiMetrics = this.externalApiMetrics.slice(-this.maxMetricsInMemory);
    }

    // Record as generic metric
    this.recordMetric({
      name: `external_api.${metric.service}.${metric.operation}`,
      duration: metric.responseTime,
      timestamp: metric.timestamp,
      tags: {
        service: metric.service,
        operation: metric.operation,
        success: metric.success,
      },
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      totalRequests,
    };
  }

  /**
   * Get API metrics statistics
   */
  getApiMetricsStats(endpoint?: string): {
    count: number;
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    let metrics = this.apiMetrics;
    
    if (endpoint) {
      metrics = metrics.filter(m => m.endpoint === endpoint);
    }

    if (metrics.length === 0) {
      return { count: 0, avgResponseTime: 0, p50: 0, p95: 0, p99: 0 };
    }

    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);

    return {
      count: metrics.length,
      avgResponseTime: sum / metrics.length,
      p50: this.percentile(responseTimes, 50),
      p95: this.percentile(responseTimes, 95),
      p99: this.percentile(responseTimes, 99),
    };
  }

  /**
   * Get external API metrics statistics
   */
  getExternalApiStats(service?: 'rxnorm' | 'rximage' | 'dailymed'): {
    count: number;
    avgResponseTime: number;
    successRate: number;
    p95: number;
  } {
    let metrics = this.externalApiMetrics;
    
    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }

    if (metrics.length === 0) {
      return { count: 0, avgResponseTime: 0, successRate: 0, p95: 0 };
    }

    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    const successCount = metrics.filter(m => m.success).length;

    return {
      count: metrics.length,
      avgResponseTime: sum / metrics.length,
      successRate: successCount / metrics.length,
      p95: this.percentile(responseTimes, 95),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[index] || 0;
  }

  /**
   * Start periodic aggregation and logging
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.logAggregatedMetrics();
    }, this.aggregationIntervalMs);
  }

  /**
   * Log aggregated metrics
   */
  private logAggregatedMetrics(): void {
    const cacheMetrics = this.getCacheMetrics();
    const apiStats = this.getApiMetricsStats();
    const rxnormStats = this.getExternalApiStats('rxnorm');
    const rxImageStats = this.getExternalApiStats('rximage');
    const dailyMedStats = this.getExternalApiStats('dailymed');

    console.log('=== Performance Metrics Summary ===');
    console.log('Cache Performance:', {
      hitRate: `${(cacheMetrics.hitRate * 100).toFixed(2)}%`,
      hits: cacheMetrics.hits,
      misses: cacheMetrics.misses,
    });
    
    console.log('API Performance:', {
      requests: apiStats.count,
      avgResponseTime: `${apiStats.avgResponseTime.toFixed(2)}ms`,
      p95: `${apiStats.p95.toFixed(2)}ms`,
      p99: `${apiStats.p99.toFixed(2)}ms`,
    });

    if (rxnormStats.count > 0) {
      console.log('RxNorm API:', {
        requests: rxnormStats.count,
        avgResponseTime: `${rxnormStats.avgResponseTime.toFixed(2)}ms`,
        successRate: `${(rxnormStats.successRate * 100).toFixed(2)}%`,
      });
    }

    if (rxImageStats.count > 0) {
      console.log('RxImage API:', {
        requests: rxImageStats.count,
        avgResponseTime: `${rxImageStats.avgResponseTime.toFixed(2)}ms`,
        successRate: `${(rxImageStats.successRate * 100).toFixed(2)}%`,
      });
    }

    if (dailyMedStats.count > 0) {
      console.log('DailyMed API:', {
        requests: dailyMedStats.count,
        avgResponseTime: `${dailyMedStats.avgResponseTime.toFixed(2)}ms`,
        successRate: `${(dailyMedStats.successRate * 100).toFixed(2)}%`,
      });
    }

    console.log('===================================');
  }

  /**
   * Stop aggregation timer
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.apiMetrics = [];
    this.externalApiMetrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// Singleton instance
let performanceServiceInstance: PerformanceService | null = null;

/**
 * Get the singleton performance service instance
 */
export function getPerformanceService(): PerformanceService {
  if (!performanceServiceInstance) {
    performanceServiceInstance = new PerformanceService();
  }
  return performanceServiceInstance;
}

/**
 * Helper function to measure async operations
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  tags?: Record<string, string | number | boolean>
): Promise<T> {
  const service = getPerformanceService();
  return service.measureAsync(operation, fn, tags);
}

/**
 * Helper function to time database queries
 */
export async function measureDatabaseQuery<T>(
  queryName: string,
  fn: () => Promise<T>
): Promise<T> {
  return measurePerformance(`db.query.${queryName}`, fn, {
    type: 'database',
  });
}

/**
 * Helper function to time external API calls
 */
export async function measureExternalApi<T>(
  service: 'rxnorm' | 'rximage' | 'dailymed',
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const perfService = getPerformanceService();
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const responseTime = Date.now() - startTime;
    
    perfService.recordExternalApiMetric({
      service,
      operation,
      responseTime,
      success: true,
      timestamp: new Date(),
    });
    
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    perfService.recordExternalApiMetric({
      service,
      operation,
      responseTime,
      success: false,
      timestamp: new Date(),
    });
    
    throw error;
  }
}
