"use strict";
/**
 * Performance Monitoring Service
 *
 * Tracks performance metrics for API endpoints, database queries,
 * external API calls, and cache operations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceService = void 0;
exports.getPerformanceService = getPerformanceService;
exports.measurePerformance = measurePerformance;
exports.measureDatabaseQuery = measureDatabaseQuery;
exports.measureExternalApi = measureExternalApi;
const Sentry = __importStar(require("@sentry/node"));
/**
 * Performance Service for tracking application performance
 */
class PerformanceService {
    metrics = [];
    apiMetrics = [];
    externalApiMetrics = [];
    cacheHits = 0;
    cacheMisses = 0;
    maxMetricsInMemory = 1000;
    aggregationIntervalMs = 60000; // 1 minute
    aggregationTimer;
    constructor() {
        this.startAggregation();
    }
    /**
     * Start a performance timing operation
     */
    startTiming(operation, tags) {
        return {
            operation,
            startTime: Date.now(),
            tags,
        };
    }
    /**
     * End a performance timing operation and record the metric
     */
    endTiming(timing, metadata) {
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
    async measureAsync(operation, fn, tags) {
        const timing = this.startTiming(operation, tags);
        try {
            const result = await fn();
            const duration = this.endTiming(timing, { success: true });
            // Log slow operations (> 1 second)
            if (duration > 1000) {
                console.warn(`Slow operation detected: ${operation} took ${duration}ms`, tags);
            }
            return result;
        }
        catch (error) {
            this.endTiming(timing, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    /**
     * Measure a synchronous operation
     */
    measureSync(operation, fn, tags) {
        const timing = this.startTiming(operation, tags);
        try {
            const result = fn();
            this.endTiming(timing, { success: true });
            return result;
        }
        catch (error) {
            this.endTiming(timing, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    /**
     * Record a generic performance metric
     */
    recordMetric(metric) {
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
        }
        catch (error) {
            // Silently fail - don't let performance monitoring break the app
            console.error('Failed to send metric to Sentry:', error);
        }
    }
    /**
     * Record API endpoint metrics
     */
    recordApiMetric(metric) {
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
    recordExternalApiMetric(metric) {
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
    recordCacheHit() {
        this.cacheHits++;
    }
    /**
     * Record cache miss
     */
    recordCacheMiss() {
        this.cacheMisses++;
    }
    /**
     * Get cache metrics
     */
    getCacheMetrics() {
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
    getApiMetricsStats(endpoint) {
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
    getExternalApiStats(service) {
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
    percentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[index] || 0;
    }
    /**
     * Start periodic aggregation and logging
     */
    startAggregation() {
        this.aggregationTimer = setInterval(() => {
            this.logAggregatedMetrics();
        }, this.aggregationIntervalMs);
    }
    /**
     * Log aggregated metrics
     */
    logAggregatedMetrics() {
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
    stop() {
        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
        }
    }
    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = [];
        this.apiMetrics = [];
        this.externalApiMetrics = [];
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
}
exports.PerformanceService = PerformanceService;
// Singleton instance
let performanceServiceInstance = null;
/**
 * Get the singleton performance service instance
 */
function getPerformanceService() {
    if (!performanceServiceInstance) {
        performanceServiceInstance = new PerformanceService();
    }
    return performanceServiceInstance;
}
/**
 * Helper function to measure async operations
 */
async function measurePerformance(operation, fn, tags) {
    const service = getPerformanceService();
    return service.measureAsync(operation, fn, tags);
}
/**
 * Helper function to time database queries
 */
async function measureDatabaseQuery(queryName, fn) {
    return measurePerformance(`db.query.${queryName}`, fn, {
        type: 'database',
    });
}
/**
 * Helper function to time external API calls
 */
async function measureExternalApi(service, operation, fn) {
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
    }
    catch (error) {
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
