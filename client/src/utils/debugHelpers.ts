/**
 * Debug Helpers for Rate Limiting and API Monitoring
 * 
 * This module provides console utilities for debugging rate limiting issues
 */

import { RateLimitedAPI } from '@/lib/rateLimiter';
import { requestDebouncer } from '@/lib/requestDebouncer';
import { apiMonitor } from '@/lib/apiMonitor';

// Global debug helpers for the browser console
if (typeof window !== 'undefined') {
  // Rate Limiter Debug Functions
  (window as any).clearKinConnectCache = () => {
    // Clear all app data for debugging
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset rate limiter
    RateLimitedAPI.reset();
    requestDebouncer.reset();
    apiMonitor.reset();
    
    console.log('🧹 All KinConnect cache and rate limiting data cleared');
    console.log('🔄 Please refresh the page to see the effect');
  };

  (window as any).rateLimiterStatus = () => {
    const status = RateLimitedAPI.getStatus();
    console.log('📊 Rate Limiter Status:', status);
    
    if (status.queueLength > 0) {
      console.warn(`⚠️ ${status.queueLength} requests queued`);
    }
    
    if (status.activeRequests > 0) {
      console.log(`🔄 ${status.activeRequests} requests currently processing`);
    }
    
    if (Object.keys(status.circuitBreakers).length > 0) {
      console.warn('🚫 Circuit breakers active:', status.circuitBreakers);
    }
    
    return status;
  };

  (window as any).apiMonitorStatus = () => {
    const status = apiMonitor.getDetailedStatus();
    console.log('📈 API Monitor Status:', status);
    
    if (status.summary.last5Minutes.rateLimited > 0) {
      console.warn(`⚠️ ${status.summary.last5Minutes.rateLimited} rate limited requests in last 5 minutes`);
    }
    
    if (status.summary.last5Minutes.successRate < 80) {
      console.warn(`⚠️ Low success rate: ${status.summary.last5Minutes.successRate}%`);
    }
    
    if (status.recentErrors.length > 0) {
      console.error('❌ Recent errors:', status.recentErrors);
    }
    
    return status;
  };

  (window as any).debouncerStatus = () => {
    const status = requestDebouncer.getStatus();
    console.log('⏱️ Request Debouncer Status:', status);
    
    const pendingCount = Object.values(status.pendingRequests).reduce((sum: number, count: any) => sum + count, 0);
    if (pendingCount > 0) {
      console.log(`⏳ ${pendingCount} requests pending`);
    }
    
    return status;
  };

  (window as any).getEndpointHealth = () => {
    const stats = apiMonitor.getEndpointStats();
    const healthReport: Record<string, any> = {};
    
    Object.entries(stats).forEach(([endpoint, stat]) => {
      const isHealthy = apiMonitor.isEndpointHealthy(endpoint);
      const recommendation = apiMonitor.getEndpointRecommendation(endpoint);
      
      healthReport[endpoint] = {
        healthy: isHealthy,
        recommendation,
        stats: {
          total: stat.totalRequests,
          successful: stat.successfulRequests,
          failed: stat.failedRequests,
          rateLimited: stat.rateLimitedRequests,
          avgResponseTime: stat.averageResponseTime + 'ms'
        }
      };
    });
    
    console.log('🏥 Endpoint Health Report:', healthReport);
    
    // Show summary
    const unhealthyEndpoints = Object.entries(healthReport).filter(([_, health]: any) => !health.healthy);
    if (unhealthyEndpoints.length > 0) {
      console.warn('⚠️ Unhealthy endpoints detected:', unhealthyEndpoints.map(([endpoint]) => endpoint));
    } else {
      console.log('✅ All endpoints are healthy');
    }
    
    return healthReport;
  };

  (window as any).resetAllRateLimiting = () => {
    RateLimitedAPI.reset();
    requestDebouncer.reset();
    apiMonitor.reset();
    console.log('🔄 All rate limiting systems reset');
  };

  (window as any).exportApiMetrics = () => {
    const metrics = apiMonitor.exportMetrics();
    console.log('📊 API Metrics Export:', metrics);
    
    // Create downloadable JSON file
    const dataStr = JSON.stringify(metrics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinconnect-api-metrics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('📁 Metrics exported to download');
    return metrics;
  };

  (window as any).showRateLimitingHelp = () => {
    console.log(`
🔧 KinConnect Rate Limiting Debug Commands:

📊 Status Commands:
  rateLimiterStatus()     - Show rate limiter queue and circuit breaker status
  apiMonitorStatus()      - Show API request metrics and error rates
  debouncerStatus()       - Show request debouncing status
  getEndpointHealth()     - Show health status of all API endpoints

🔄 Reset Commands:
  clearKinConnectCache()  - Clear all app cache and reset rate limiting
  resetAllRateLimiting()  - Reset only rate limiting systems
  resetRateLimiter()      - Reset just the rate limiter
  resetDebouncer()        - Reset just the request debouncer

📁 Export Commands:
  exportApiMetrics()      - Download API metrics as JSON file

🆘 If you're experiencing rate limiting issues:
1. Run apiMonitorStatus() to see current error rates
2. Run getEndpointHealth() to identify problematic endpoints
3. Run clearKinConnectCache() to reset everything
4. Refresh the page and monitor with rateLimiterStatus()

💡 The new system includes:
- Request queuing (max 3 concurrent)
- Exponential backoff for retries
- Circuit breakers for failing endpoints
- Smart caching to reduce API calls
- Request debouncing to prevent rapid calls
    `);
  };

  // Auto-show help on load in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 KinConnect Debug Mode - Type showRateLimitingHelp() for debugging commands');
  }
}

export {};