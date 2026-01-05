/**
 * Performance Monitoring Middleware
 * 
 * Tracks request/response time for all API endpoints
 * and integrates with the performance service.
 */

import { Request, Response, NextFunction } from 'express';
import { getPerformanceService } from '../services/performanceService';

// Threshold for slow request warnings (in milliseconds)
const SLOW_REQUEST_THRESHOLD = 1000;

/**
 * Performance monitoring middleware
 * Measures response time and adds X-Response-Time header
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const performanceService = getPerformanceService();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to measure response time
  res.end = function (this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;

    // Add X-Response-Time header
    res.setHeader('X-Response-Time', `${duration}ms`);

    // Extract endpoint path (remove query params and trailing slashes)
    const endpoint = req.path.replace(/\?.*/g, '').replace(/\/$/g, '') || '/';

    // Record API metric
    performanceService.recordApiMetric({
      endpoint,
      method: req.method,
      responseTime: duration,
      statusCode: res.statusCode,
      timestamp: new Date(),
    });

    // Log slow requests
    if (duration > SLOW_REQUEST_THRESHOLD) {
      console.warn(`Slow request detected: ${req.method} ${endpoint} took ${duration}ms`, {
        statusCode: res.statusCode,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
    }

    // Call the original end function
    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Create endpoint-specific performance tracking middleware
 */
export function createEndpointPerformanceMiddleware(
  endpointName: string,
  slowThreshold = SLOW_REQUEST_THRESHOLD
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const performanceService = getPerformanceService();
    const timing = performanceService.startTiming(`endpoint.${endpointName}`, {
      method: req.method,
      endpoint: endpointName,
    });

    // Capture the original end function
    const originalEnd = res.end;

    // Override res.end to measure response time
    res.end = function (this: Response, ...args: any[]): Response {
      const duration = performanceService.endTiming(timing, {
        statusCode: res.statusCode,
        success: res.statusCode < 400,
      });

      // Log slow requests for this specific endpoint
      if (duration > slowThreshold) {
        console.warn(
          `Slow endpoint: ${endpointName} (${req.method}) took ${duration}ms`,
          {
            statusCode: res.statusCode,
            threshold: slowThreshold,
          }
        );
      }

      // Call the original end function
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Performance summary middleware
 * Adds performance summary to response for debugging (only in development)
 */
export function performanceSummaryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only add summary in development or if X-Performance-Debug header is present
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isDebugRequested = req.get('X-Performance-Debug') === 'true';

  if (!isDevelopment && !isDebugRequested) {
    return next();
  }

  const performanceService = getPerformanceService();
  const startTime = Date.now();

  // Capture the original json function
  const originalJson = res.json;

  // Override res.json to add performance summary
  res.json = function (this: Response, body: any): Response {
    const duration = Date.now() - startTime;

    // Add performance summary to response
    const enhancedBody = {
      ...body,
      _performance: {
        responseTime: `${duration}ms`,
        timestamp: new Date().toISOString(),
        cache: performanceService.getCacheMetrics(),
      },
    };

    // Call the original json function
    return originalJson.call(this, enhancedBody);
  };

  next();
}

/**
 * Sampling middleware for performance tracking
 * Only tracks a percentage of requests to reduce overhead
 */
export function createSamplingMiddleware(sampleRate: number = 0.1) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip performance tracking for sampled-out requests
    if (Math.random() > sampleRate) {
      return next();
    }

    // Add flag to indicate this request is being tracked
    (req as any).performanceTracked = true;

    // Apply performance middleware
    performanceMiddleware(req, res, next);
  };
}

/**
 * Health check endpoint performance middleware
 * Skips tracking for health checks to reduce noise
 */
export function skipHealthCheckMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip performance tracking for health check endpoints
  if (
    req.path === '/health' ||
    req.path === '/api/health' ||
    req.path === '/healthz' ||
    req.path === '/api/healthz'
  ) {
    // Mark as skipped
    (req as any).performanceSkipped = true;
    return next();
  }

  next();
}
