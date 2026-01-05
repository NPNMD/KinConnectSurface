# Performance Monitoring Guide

## Overview

KinConnect implements comprehensive performance monitoring to ensure optimal application performance, identify bottlenecks, and maintain a high-quality user experience. This document outlines the performance monitoring infrastructure, key metrics, and how to use the performance monitoring tools.

## Table of Contents

1. [Architecture](#architecture)
2. [Monitored Metrics](#monitored-metrics)
3. [Performance Budgets](#performance-budgets)
4. [Accessing Performance Data](#accessing-performance-data)
5. [Performance Middleware](#performance-middleware)
6. [Client-Side Monitoring](#client-side-monitoring)
7. [Core Web Vitals](#core-web-vitals)
8. [Performance Testing](#performance-testing)
9. [Optimization Strategies](#optimization-strategies)
10. [Alert Configuration](#alert-configuration)

## Architecture

The performance monitoring system consists of several components:

### Backend Components

1. **Performance Service** (`shared/services/performanceService.ts`)
   - Centralized service for tracking performance metrics
   - Records API response times, database queries, external API calls
   - Aggregates and reports metrics periodically

2. **Performance Middleware** (`shared/middleware/performance.ts`)
   - Express middleware for tracking request/response times
   - Adds `X-Response-Time` header to all responses
   - Logs slow requests (> 1 second)

3. **Sentry Integration**
   - Automatic transaction tracking for all requests
   - Custom performance instrumentation
   - Error correlation with performance data

### Frontend Components

1. **Sentry Client** (`client/src/lib/sentry.ts`)
   - Custom performance tracking for user flows
   - API call monitoring
   - Component render performance

2. **Core Web Vitals** (`client/src/main.tsx`)
   - LCP (Largest Contentful Paint)
   - FID (First Input Delay)
   - CLS (Cumulative Layout Shift)
   - FCP (First Contentful Paint)
   - TTFB (Time to First Byte)

3. **Route Change Tracking**
   - Monitors navigation performance
   - Tracks page load times
   - Detects performance regressions

## Monitored Metrics

### API Metrics

| Metric | Description | Threshold |
|--------|-------------|-----------|
| Response Time (avg) | Average API response time | < 500ms |
| Response Time (p50) | Median response time | < 300ms |
| Response Time (p95) | 95th percentile response time | < 1000ms |
| Response Time (p99) | 99th percentile response time | < 2000ms |
| Error Rate | Percentage of failed requests | < 1% |

### Database Metrics

| Metric | Description | Threshold |
|--------|-------------|-----------|
| Query Time | Individual query execution time | < 100ms |
| Query Time (p95) | 95th percentile query time | < 500ms |
| Connection Pool Usage | Database connection utilization | < 80% |

### External API Metrics

| Metric | Service | Threshold |
|--------|---------|-----------|
| RxNorm Response Time | Drug search API | < 2000ms |
| RxImage Response Time | Drug image API | < 3000ms |
| DailyMed Response Time | Drug info API | < 2000ms |
| Success Rate | All external APIs | > 99% |

### Cache Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Hit Rate | Percentage of cache hits | > 80% |
| Miss Rate | Percentage of cache misses | < 20% |
| Eviction Rate | Rate of cache evictions | < 5% |

### Client-Side Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| LCP (Largest Contentful Paint) | Loading performance | < 2.5s (good) |
| FID (First Input Delay) | Interactivity | < 100ms (good) |
| CLS (Cumulative Layout Shift) | Visual stability | < 0.1 (good) |
| FCP (First Contentful Paint) | Initial render time | < 1.8s (good) |
| TTFB (Time to First Byte) | Server response time | < 600ms (good) |

## Performance Budgets

### Page Load Budget

- **Initial Page Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds
- **Bundle Size**: < 500KB (gzipped)

### API Response Budget

- **Authentication**: < 500ms
- **Medication CRUD**: < 300ms
- **Drug Search**: < 1000ms
- **Patient Management**: < 500ms

### Database Query Budget

- **Single document read**: < 50ms
- **Collection query**: < 100ms
- **Complex aggregation**: < 500ms

## Accessing Performance Data

### Sentry Performance Dashboard

1. **Navigate to Sentry Dashboard**
   - URL: `https://sentry.io/organizations/[org]/projects/[project]/performance/`
   - Login with your Sentry credentials

2. **View Transaction Performance**
   - Filter by transaction name (e.g., `POST /api/medications`)
   - View p50, p75, p95, p99 response times
   - Identify slow spans and bottlenecks

3. **Custom Metrics**
   - Navigate to "Custom Metrics" tab
   - View application-specific measurements
   - Create dashboards for key metrics

### Application Logs

Performance metrics are logged to the console every minute:

```
=== Performance Metrics Summary ===
Cache Performance: {
  hitRate: "85.50%",
  hits: 342,
  misses: 58
}
API Performance: {
  requests: 1250,
  avgResponseTime: "245.32ms",
  p95: "892.15ms",
  p99: "1543.87ms"
}
RxNorm API: {
  requests: 45,
  avgResponseTime: "1205.43ms",
  successRate: "100.00%"
}
===================================
```

### Performance Headers

All API responses include performance headers:

```
X-Response-Time: 123ms
```

## Performance Middleware

### Usage

The performance middleware is automatically applied to all API routes:

```typescript
import { performanceMiddleware } from '../../shared/middleware/performance';

app.use(performanceMiddleware);
```

### Custom Endpoint Tracking

Track specific endpoints with custom thresholds:

```typescript
import { createEndpointPerformanceMiddleware } from '../../shared/middleware/performance';

router.post(
  '/medications',
  createEndpointPerformanceMiddleware('create_medication', 500), // 500ms threshold
  async (req, res) => {
    // Handler
  }
);
```

### Skipping Health Checks

Health check endpoints are automatically excluded from tracking:

```typescript
import { skipHealthCheckMiddleware } from '../../shared/middleware/performance';

app.use(skipHealthCheckMiddleware);
```

## Client-Side Monitoring

### Tracking User Flows

Use the custom performance tracking functions:

```typescript
import { trackLoginPerformance, trackMedicationCreation, trackDrugSearch } from './lib/sentry';

// Track login
const startTime = Date.now();
await signIn(email, password);
trackLoginPerformance('email', Date.now() - startTime, true);

// Track medication creation
const createStart = Date.now();
await createMedication(data);
trackMedicationCreation(Date.now() - createStart, true);

// Track drug search
const searchStart = Date.now();
const results = await searchDrugs(query);
trackDrugSearch(query, results.length, Date.now() - searchStart);
```

### Tracking API Calls

API calls are automatically tracked:

```typescript
import { trackApiCall } from './lib/sentry';

const response = await fetch('/api/medications', {
  method: 'POST',
  body: JSON.stringify(data),
});

trackApiCall('/api/medications', 'POST', duration, response.status);
```

### Component Render Tracking

Track component render performance:

```typescript
import { trackComponentRender } from './lib/sentry';
import { useEffect } from 'react';

function MyComponent() {
  useEffect(() => {
    const renderTime = performance.now();
    trackComponentRender('MyComponent', renderTime);
  }, []);

  return <div>Content</div>;
}
```

## Core Web Vitals

Core Web Vitals are automatically tracked and reported to Sentry.

### LCP (Largest Contentful Paint)

- **Good**: < 2.5s
- **Needs Improvement**: 2.5s - 4s
- **Poor**: > 4s

**Optimization Tips:**
- Optimize images (use WebP, lazy loading)
- Minimize render-blocking resources
- Improve server response time (TTFB)
- Use CDN for static assets

### FID (First Input Delay)

- **Good**: < 100ms
- **Needs Improvement**: 100ms - 300ms
- **Poor**: > 300ms

**Optimization Tips:**
- Break up long tasks
- Use code splitting
- Minimize JavaScript execution
- Use web workers for heavy computations

### CLS (Cumulative Layout Shift)

- **Good**: < 0.1
- **Needs Improvement**: 0.1 - 0.25
- **Poor**: > 0.25

**Optimization Tips:**
- Set dimensions on images and videos
- Avoid inserting content above existing content
- Use CSS transform animations
- Reserve space for dynamic content

## Performance Testing

### Benchmarking

Use the performance testing utilities:

```typescript
import { benchmark, formatBenchmarkResult } from '../shared/__tests__/performanceUtils';

const result = await benchmark(
  async () => {
    await myFunction();
  },
  {
    iterations: 100,
    warmupIterations: 10,
  }
);

console.log(formatBenchmarkResult(result));
```

### Load Testing

Test application under load:

```typescript
import { loadTest, formatLoadTestResult } from '../shared/__tests__/performanceUtils';

const result = await loadTest(
  async () => {
    await fetch('/api/medications');
  },
  {
    concurrency: 50,
    duration: 30000, // 30 seconds
    rampUpTime: 5000, // 5 seconds
  }
);

console.log(formatLoadTestResult(result));
```

### Performance Assertions

Add performance assertions to tests:

```typescript
import { assertPerformance, assertAveragePerformance } from '../shared/__tests__/performanceUtils';

// Assert single operation
const start = Date.now();
await myOperation();
assertPerformance(Date.now() - start, 500, 'Operation too slow');

// Assert average performance
await assertAveragePerformance(
  async () => await myOperation(),
  300, // max average time: 300ms
  10 // iterations
);
```

## Optimization Strategies

### Backend Optimization

1. **Database Optimization**
   - Add appropriate indexes (see `FIRESTORE_INDEXES.md`)
   - Use pagination for large result sets
   - Implement query result caching
   - Denormalize data for read-heavy operations

2. **API Optimization**
   - Enable response caching
   - Use HTTP/2 for multiplexing
   - Implement request batching
   - Optimize serialization (use compression)

3. **External API Optimization**
   - Cache API responses (see `CACHING.md`)
   - Implement request deduplication
   - Use parallel requests where possible
   - Set appropriate timeouts

### Frontend Optimization

1. **Bundle Optimization**
   - Code splitting by route
   - Tree shaking unused code
   - Lazy load heavy components
   - Use dynamic imports

2. **Asset Optimization**
   - Use WebP images with fallbacks
   - Implement responsive images
   - Lazy load images below the fold
   - Compress and minify assets

3. **Rendering Optimization**
   - Use React.memo for expensive components
   - Implement virtual scrolling for long lists
   - Debounce expensive operations
   - Use CSS containment

## Alert Configuration

### Sentry Alerts

Configure alerts for performance thresholds:

1. **Navigate to Alerts**
   - Sentry Dashboard → Alerts → Create Alert Rule

2. **Performance Degradation Alert**
   ```
   Metric: Transaction Duration (p95)
   Threshold: > 1000ms
   Time Window: 5 minutes
   Environment: production
   ```

3. **Slow API Endpoint Alert**
   ```
   Metric: Transaction Duration (avg)
   Filter: transaction contains "/api"
   Threshold: > 500ms
   Time Window: 10 minutes
   ```

4. **Core Web Vitals Alert**
   ```
   Metric: LCP (p75)
   Threshold: > 2500ms
   Time Window: 15 minutes
   Environment: production
   ```

### Application Alerts

The application automatically logs warnings for:

- **Slow Requests**: > 1 second
- **Slow Queries**: > 500ms
- **Low Cache Hit Rate**: < 50%
- **High Memory Usage**: > 80% of limit

## Key Performance Indicators (KPIs)

### User Experience KPIs

1. **Page Load Time**: < 3s (target)
2. **Time to Interactive**: < 5s (target)
3. **API Response Time**: < 500ms (target)

### System Performance KPIs

1. **Server Response Time (TTFB)**: < 600ms
2. **Database Query Time**: < 100ms
3. **Cache Hit Rate**: > 80%
4. **External API Success Rate**: > 99%

### Reliability KPIs

1. **Error Rate**: < 0.1%
2. **Availability**: > 99.9%
3. **Failed Request Rate**: < 1%

## Best Practices

1. **Monitor in Production**: Always enable performance monitoring in production
2. **Set Baselines**: Establish performance baselines for comparison
3. **Regular Reviews**: Review performance metrics weekly
4. **Alert Fatigue**: Avoid setting too many alerts; focus on critical metrics
5. **User-Centric**: Focus on metrics that impact user experience
6. **Correlate Metrics**: Look for patterns across different metrics
7. **Document Changes**: Document performance impact of major changes
8. **Continuous Improvement**: Regularly optimize based on metrics

## Troubleshooting

### Slow API Responses

1. Check Sentry transaction traces for bottlenecks
2. Review database query performance
3. Verify cache hit rates
4. Check external API response times
5. Review server resource utilization

### High Client-Side Load Times

1. Check Core Web Vitals in Sentry
2. Analyze bundle size and composition
3. Review network waterfall in browser DevTools
4. Check for render-blocking resources
5. Verify CDN performance

### Poor Cache Performance

1. Review cache configuration
2. Check cache key patterns
3. Verify TTL settings
4. Monitor eviction rates
5. Analyze access patterns

## Resources

- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Web Vitals](https://web.dev/vitals/)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [Lighthouse Performance Audits](https://developers.google.com/web/tools/lighthouse)

## Support

For questions or issues with performance monitoring:

- Check Sentry dashboard for detailed traces
- Review application logs
- Consult the development team
- Open an issue in the project repository
