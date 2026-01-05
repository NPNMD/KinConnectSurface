# Redis Caching Implementation

This document describes the Redis caching layer implementation for KinConnect's drug API calls.

## Overview

The caching system provides a non-blocking, Redis-based caching layer for external API calls to RxNorm, RxImage, and DailyMed. The implementation follows a graceful fallback design - if Redis is unavailable, the application continues to work by making direct API calls.

## Architecture

### Components

1. **Cache Service** ([`shared/services/cacheService.ts`](shared/services/cacheService.ts))
   - Main cache interface
   - Redis connection management
   - Error handling and graceful degradation
   - Connection pooling via Redis v4 client

2. **Drug Service** ([`shared/services/drugService.ts`](shared/services/drugService.ts))
   - Caches drug search results, details, interactions, and related drugs
   - 24-hour TTL for all drug data

3. **RxImage Service** ([`shared/services/rxImageService.ts`](shared/services/rxImageService.ts))
   - Caches drug images by RxCUI, NDC, and name
   - 7-day TTL for image URLs (images change infrequently)

4. **DailyMed Service** ([`shared/services/dailyMedService.ts`](shared/services/dailyMedService.ts))
   - Caches drug search results and clinical information
   - 24-hour TTL for clinical data

### Cache Key Strategy

Cache keys follow a consistent naming pattern with versioning:

```
{version}:{namespace}:{key}
```

Examples:
- `v1:drug:rxcui:161`
- `v1:drug:search:aspirin:20`
- `v1:image:rxcui:161`
- `v1:dailymed:search:metformin`
- `v1:dailymed:details:abc123-def456`

**Namespaces:**
- `drug` - RxNorm drug data
- `image` - RxImage drug images
- `dailymed` - DailyMed clinical information

**Versioning:**
The `CACHE_KEY_VERSION` environment variable allows for cache invalidation when deploying changes. Simply increment the version (e.g., from `v1` to `v2`) to effectively clear all cached data.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Redis Cache Configuration
REDIS_URL=redis://localhost:6379
ENABLE_CACHE=true
CACHE_TTL_DRUG_DATA=86400      # 24 hours in seconds
CACHE_TTL_IMAGES=604800         # 7 days in seconds
CACHE_KEY_VERSION=v1            # Increment for cache invalidation
```

### TTL Values

| Data Type | Default TTL | Reason |
|-----------|------------|--------|
| Drug Data | 24 hours | Drug information updates periodically |
| Images | 7 days | Drug images change very infrequently |
| Clinical Info | 24 hours | Clinical data may be updated regularly |

### Feature Flag

The cache can be disabled via the `ENABLE_CACHE` environment variable:

```bash
ENABLE_CACHE=false  # Disable caching entirely
```

When disabled, all API calls go directly to external services.

## Installation

### 1. Install Dependencies

```bash
# Root project
npm install redis@^4.6.12
npm install --save-dev @types/redis@^4.0.11

# Firebase Functions
cd functions
npm install redis@^4.6.12
npm install --save-dev @types/redis@^4.0.11
```

### 2. Set Up Redis

#### Local Development

Using Docker:
```bash
docker run --name kinconnect-redis -p 6379:6379 -d redis:7-alpine
```

Using Homebrew (macOS):
```bash
brew install redis
brew services start redis
```

Using APT (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

#### Production

For production, use a managed Redis service:

- **Google Cloud Memorystore** (recommended for Firebase)
  - Fully managed Redis service
  - Automatic backups
  - High availability
  - VPC peering with Cloud Functions

- **Redis Cloud** (cloud-agnostic)
  - Free tier available
  - Multiple cloud providers
  - Global replication

- **AWS ElastiCache** (if using AWS)
  - Fully managed
  - Multi-AZ support

## Usage

The caching layer is automatically integrated into the service layer. No changes are needed in route handlers or controllers.

### Example Flow

```typescript
// User searches for "aspirin"
// 1. Service checks cache: v1:drug:search:aspirin:20
// 2. Cache miss - makes API call to RxNorm
// 3. Stores result in cache with 24h TTL
// 4. Returns result to user

// Next user searches for "aspirin"
// 1. Service checks cache: v1:drug:search:aspirin:20
// 2. Cache hit - returns cached data
// 3. No API call needed
```

### Manual Cache Operations

The cache service provides methods for manual operations:

```typescript
import { cacheService } from './shared/services/cacheService';

// Get cache statistics
const stats = await cacheService.getStats();
console.log(stats); // { connected: true, keyCount: 42 }

// Clear all cache entries for current version
await cacheService.clearVersion();

// Delete specific cache entry
await cacheService.delete('drug', 'rxcui:161');

// Delete all entries matching a pattern
await cacheService.deletePattern('drug:search:*');

// Check if cache is available
if (cacheService.isAvailable()) {
  console.log('Cache is connected and ready');
}
```

## Performance Impact

### Expected Improvements

| Metric | Before Cache | With Cache | Improvement |
|--------|--------------|------------|-------------|
| Drug search response time | ~500ms | ~10ms | **98% faster** |
| Image lookup time | ~800ms | ~10ms | **98.8% faster** |
| API call volume | 100% | ~5-10% | **90-95% reduction** |
| Server load | High | Low | Significant |

### Cache Hit Rates

Expected cache hit rates vary by data type:

- **Drug searches**: 70-85% (common searches cached)
- **Drug details**: 60-75% (repeat lookups)
- **Drug images**: 80-90% (image URLs rarely change)
- **Clinical info**: 50-70% (less frequently accessed)

## Monitoring

### Health Checks

Monitor Redis connection status:

```typescript
const stats = await cacheService.getStats();
if (!stats.connected) {
  console.error('Redis cache is unavailable');
  // Alert operations team
}
```

### Metrics to Track

1. **Cache Hit Rate**
   - Target: >70% overall
   - Formula: `(cache_hits / total_requests) * 100`

2. **Redis Connection Status**
   - Monitor connection drops
   - Track reconnection attempts

3. **Response Times**
   - Compare cached vs. uncached requests
   - Track p95, p99 latencies

4. **Cache Size**
   - Monitor memory usage
   - Set eviction policies if needed

### Logging

The cache service logs important events:

```
[INFO] Redis client connected
[INFO] Redis client ready
[WARN] Cache is disabled or REDIS_URL not configured
[ERROR] Redis Client Error: <error details>
[ERROR] Cache get error: <error details>
```

## Cache Warming Strategies

For frequently accessed data, consider pre-warming the cache:

### 1. Application Startup

```typescript
async function warmCache() {
  const popularDrugs = ['aspirin', 'metformin', 'lisinopril', 'amlodipine'];
  
  for (const drug of popularDrugs) {
    await drugService.searchDrugs(drug);
    // This will cache the results
  }
}

// Call during app initialization
warmCache().catch(console.error);
```

### 2. Background Job

```typescript
// Run every 6 hours to refresh popular searches
setInterval(async () => {
  await warmCache();
}, 6 * 60 * 60 * 1000);
```

### 3. Predictive Warming

Monitor search patterns and pre-cache trending medications.

## Error Handling

The caching layer is designed to be non-blocking:

1. **Redis Connection Fails**
   - Application continues without cache
   - All requests go directly to external APIs
   - Errors logged but not surfaced to users

2. **Cache Operation Fails**
   - Operation is skipped
   - Application proceeds normally
   - Error logged for monitoring

3. **Maximum Connection Attempts**
   - After 3 failed connection attempts, stops retrying
   - Can be restarted by redeploying application

### Example Error Log

```
Redis connection failed (attempt 1): Error: ECONNREFUSED 127.0.0.1:6379
Redis connection failed (attempt 2): Error: ECONNREFUSED 127.0.0.1:6379
Redis connection failed (attempt 3): Error: ECONNREFUSED 127.0.0.1:6379
Application continuing without cache
```

## Testing

### Unit Tests

Mock the cache service in tests:

```typescript
import { cacheService } from './shared/services/cacheService';

jest.mock('./shared/services/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null), // Cache miss
    set: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(true),
  },
}));
```

### Integration Tests

Test with a real Redis instance:

```typescript
beforeAll(async () => {
  // Start Redis container
  await exec('docker run -d -p 6379:6379 redis:7-alpine');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for startup
});

afterAll(async () => {
  await cacheService.disconnect();
  // Stop Redis container
});

test('should cache drug search results', async () => {
  const query = 'test-drug';
  
  // First call - cache miss
  const result1 = await drugService.searchDrugs(query);
  
  // Second call - cache hit
  const result2 = await drugService.searchDrugs(query);
  
  expect(result1).toEqual(result2);
  // Verify only one API call was made
});
```

### Load Tests

Test cache performance under load:

```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:5000/api/drugs/search?q=aspirin

# With cache: ~10ms avg response time
# Without cache: ~500ms avg response time
```

## Deployment

### Development

1. Start Redis locally (see Installation section)
2. Update `.env` with Redis connection string
3. Restart application

### Staging/Production

1. Provision Redis instance (e.g., Google Cloud Memorystore)
2. Configure VPC peering if needed
3. Add Redis URL to environment variables in Firebase Console
4. Deploy functions: `npm run deploy`
5. Verify cache connection in logs

### Cache Invalidation on Deploy

When deploying breaking changes to cached data structures:

```bash
# Increment cache version in .env
CACHE_KEY_VERSION=v2  # Was v1

# Deploy
npm run deploy
```

This ensures old cached data is ignored without manually clearing Redis.

## Troubleshooting

### Cache Not Working

1. **Check Redis connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Verify environment variables:**
   ```bash
   echo $REDIS_URL
   echo $ENABLE_CACHE
   ```

3. **Check application logs:**
   ```bash
   # Look for "Redis client ready" message
   tail -f logs/application.log | grep -i redis
   ```

### High Memory Usage

1. **Check key count:**
   ```typescript
   const stats = await cacheService.getStats();
   console.log(stats.keyCount);
   ```

2. **Configure eviction policy:**
   ```bash
   # In redis.conf or via command
   CONFIG SET maxmemory-policy allkeys-lru
   CONFIG SET maxmemory 256mb
   ```

3. **Clear old versions:**
   ```typescript
   // Clear v1 when using v2
   await cacheService.deletePattern('v1:*');
   ```

### Performance Not Improving

1. **Verify cache hit rates** - should be >50%
2. **Check Redis latency** - should be <5ms
3. **Ensure Redis is on same network** as application
4. **Monitor slow queries** in Redis

## Security

### Best Practices

1. **Use TLS connections** for production:
   ```bash
   REDIS_URL=rediss://username:password@host:6380
   ```

2. **Set strong password:**
   ```bash
   # In redis.conf
   requirepass your-strong-password-here
   ```

3. **Enable AUTH:**
   ```bash
   REDIS_URL=redis://:password@localhost:6379
   ```

4. **Limit network access:**
   - Use VPC peering
   - Configure firewall rules
   - Restrict to application IPs only

5. **Regular backups:**
   - Enable Redis persistence (RDB/AOF)
   - Regular snapshots for managed services

## Maintenance

### Regular Tasks

1. **Monitor cache hit rates** - Weekly
2. **Review cache size and memory** - Weekly
3. **Clear old cache versions** - After each deploy
4. **Performance testing** - Monthly
5. **Security updates** - As needed

### Optimization Opportunities

1. **Adjust TTL values** based on usage patterns
2. **Implement cache warming** for popular searches
3. **Add cache compression** for large objects
4. **Use Redis pipelining** for batch operations

## Future Enhancements

Potential improvements for the caching layer:

1. **Cache Compression**
   - Reduce memory usage by 50-70%
   - Trade-off: slight CPU overhead

2. **Multi-tier Caching**
   - Add in-memory cache (LRU) before Redis
   - Further reduce latency for hot data

3. **Intelligent TTL**
   - Extend TTL for frequently accessed items
   - Shorter TTL for rarely accessed items

4. **Cache Analytics**
   - Dashboard showing hit rates, popular searches
   - Automated alerts for cache issues

5. **Distributed Caching**
   - Redis Cluster for horizontal scaling
   - Support for millions of cached items

## Support

For issues or questions about the caching implementation:

1. Check this documentation
2. Review application logs
3. Check Redis logs
4. Contact the development team

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Node.js Client](https://github.com/redis/node-redis)
- [Google Cloud Memorystore](https://cloud.google.com/memorystore/docs/redis)
- [Caching Best Practices](https://redis.io/docs/latest/develop/use/patterns/)
