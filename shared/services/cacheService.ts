import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

/**
 * Cache Service for Redis-based caching
 * 
 * Features:
 * - Non-blocking: Falls back gracefully if Redis is unavailable
 * - Connection pooling via Redis v4 client
 * - Configurable TTL per operation
 * - Versioned cache keys for easy invalidation
 */
export class CacheService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isInitializing = false;
  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;

  constructor() {
    if (config.ENABLE_CACHE && config.REDIS_URL) {
      this.initialize();
    } else {
      console.log('Cache is disabled or REDIS_URL not configured');
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    if (this.isInitializing || this.isConnected) {
      return;
    }

    this.isInitializing = true;

    try {
      this.client = createClient({
        url: config.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // Exponential backoff with max 3 seconds
            const delay = Math.min(retries * 100, 3000);
            return delay;
          },
          connectTimeout: 5000,
        },
      });

      // Set up event handlers
      this.client.on('error', (error) => {
        console.error('Redis Client Error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis client connected');
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on('end', () => {
        console.log('Redis client disconnected');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
    } catch (error) {
      this.connectionAttempts++;
      console.error(`Redis connection failed (attempt ${this.connectionAttempts}):`, error);
      this.client = null;
      this.isConnected = false;

      // Retry connection after delay if under max attempts
      if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
        setTimeout(() => {
          this.isInitializing = false;
          this.initialize();
        }, 5000);
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Build cache key with versioning
   */
  private buildKey(namespace: string, key: string): string {
    return `${config.CACHE_KEY_VERSION}:${namespace}:${key}`;
  }

  /**
   * Get value from cache
   * @param namespace - Cache namespace (e.g., 'drug', 'image')
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const cacheKey = this.buildKey(namespace, key);
      const value = await this.client.get(cacheKey);
      
      if (value) {
        return JSON.parse(value) as T;
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param namespace - Cache namespace (e.g., 'drug', 'image')
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set(namespace: string, key: string, value: any, ttl: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const cacheKey = this.buildKey(namespace, key);
      const serialized = JSON.stringify(value);
      
      await this.client.setEx(cacheKey, ttl, serialized);
    } catch (error) {
      console.error('Cache set error:', error);
      // Non-blocking: don't throw, just log
    }
  }

  /**
   * Delete a cache entry
   * @param namespace - Cache namespace
   * @param key - Cache key
   */
  async delete(namespace: string, key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const cacheKey = this.buildKey(namespace, key);
      await this.client.del(cacheKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete all cache entries matching a pattern
   * @param pattern - Pattern to match (e.g., 'drug:*')
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const fullPattern = this.buildKey('*', pattern);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Clear all cache entries for a specific version
   * Useful for cache invalidation when deploying changes
   */
  async clearVersion(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const pattern = `${config.CACHE_KEY_VERSION}:*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`Cleared ${keys.length} cache entries for version ${config.CACHE_KEY_VERSION}`);
      }
    } catch (error) {
      console.error('Cache clear version error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ connected: boolean; keyCount?: number }> {
    if (!this.isConnected || !this.client) {
      return { connected: false };
    }

    try {
      const pattern = `${config.CACHE_KEY_VERSION}:*`;
      const keys = await this.client.keys(pattern);
      
      return {
        connected: true,
        keyCount: keys.length,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { connected: false };
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('Redis client disconnected gracefully');
      } catch (error) {
        console.error('Error disconnecting Redis client:', error);
      }
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
