"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cacheService_1 = require("../cacheService");
const testUtils_1 = require("../../__tests__/testUtils");
// Mock redis module
jest.mock('redis', () => ({
    createClient: jest.fn()
}));
// Mock config
jest.mock('../../config', () => ({
    config: {
        ENABLE_CACHE: true,
        REDIS_URL: 'redis://localhost:6379',
        CACHE_KEY_VERSION: 'v1'
    }
}));
(0, testUtils_1.mockConsole)();
describe('CacheService', () => {
    let service;
    let mockRedisClient;
    const { createClient } = require('redis');
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisClient = (0, testUtils_1.createMockRedisClient)();
        createClient.mockReturnValue(mockRedisClient);
    });
    describe('initialization', () => {
        it('should initialize when cache is enabled', () => {
            service = new cacheService_1.CacheService();
            expect(createClient).toHaveBeenCalledWith({
                url: 'redis://localhost:6379',
                socket: expect.objectContaining({
                    connectTimeout: 5000
                })
            });
            expect(mockRedisClient.connect).toHaveBeenCalled();
        });
        it('should not initialize when cache is disabled', () => {
            jest.resetModules();
            jest.doMock('../../config', () => ({
                config: {
                    ENABLE_CACHE: false,
                    REDIS_URL: null,
                    CACHE_KEY_VERSION: 'v1'
                }
            }));
            const { CacheService } = require('../cacheService');
            const disabledService = new CacheService();
            expect(console.log).toHaveBeenCalledWith('Cache is disabled or REDIS_URL not configured');
        });
    });
    describe('get', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            // Simulate connection ready
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should retrieve cached value and parse JSON', async () => {
            const cachedData = { name: 'Aspirin', rxcui: '313782' };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));
            const result = await service.get('drug', 'aspirin');
            expect(mockRedisClient.get).toHaveBeenCalledWith('v1:drug:aspirin');
            expect(result).toEqual(cachedData);
        });
        it('should return null when key does not exist', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            const result = await service.get('drug', 'nonexistent');
            expect(result).toBeNull();
        });
        it('should return null when not connected', async () => {
            const disconnectedService = new cacheService_1.CacheService();
            const result = await disconnectedService.get('drug', 'test');
            expect(result).toBeNull();
        });
        it('should handle errors gracefully', async () => {
            mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
            const result = await service.get('drug', 'test');
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('set', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should cache value with TTL', async () => {
            const data = { name: 'Aspirin' };
            await service.set('drug', 'aspirin', data, 3600);
            expect(mockRedisClient.setEx).toHaveBeenCalledWith('v1:drug:aspirin', 3600, JSON.stringify(data));
        });
        it('should not throw when not connected', async () => {
            const disconnectedService = new cacheService_1.CacheService();
            await expect(disconnectedService.set('drug', 'test', {}, 100)).resolves.not.toThrow();
        });
        it('should handle errors gracefully', async () => {
            mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
            await expect(service.set('drug', 'test', {}, 100)).resolves.not.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('delete', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should delete cache entry', async () => {
            await service.delete('drug', 'aspirin');
            expect(mockRedisClient.del).toHaveBeenCalledWith('v1:drug:aspirin');
        });
        it('should handle errors gracefully', async () => {
            mockRedisClient.del.mockRejectedValue(new Error('Redis error'));
            await expect(service.delete('drug', 'test')).resolves.not.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('deletePattern', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should delete all keys matching pattern', async () => {
            const keys = ['v1:drug:aspirin', 'v1:drug:ibuprofen'];
            mockRedisClient.keys.mockResolvedValue(keys);
            await service.deletePattern('drug:*');
            expect(mockRedisClient.keys).toHaveBeenCalledWith('v1:*:drug:*');
            expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
        });
        it('should not delete when no keys match', async () => {
            mockRedisClient.keys.mockResolvedValue([]);
            await service.deletePattern('nonexistent:*');
            expect(mockRedisClient.del).not.toHaveBeenCalled();
        });
    });
    describe('clearVersion', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should clear all cache entries for version', async () => {
            const keys = ['v1:drug:test', 'v1:image:test'];
            mockRedisClient.keys.mockResolvedValue(keys);
            await service.clearVersion();
            expect(mockRedisClient.keys).toHaveBeenCalledWith('v1:*');
            expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 2 cache entries'));
        });
    });
    describe('getStats', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should return cache statistics when connected', async () => {
            mockRedisClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);
            const stats = await service.getStats();
            expect(stats).toEqual({
                connected: true,
                keyCount: 3
            });
        });
        it('should return disconnected status when not connected', async () => {
            const disconnectedService = new cacheService_1.CacheService();
            const stats = await disconnectedService.getStats();
            expect(stats).toEqual({ connected: false });
        });
        it('should handle errors gracefully', async () => {
            mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));
            const stats = await service.getStats();
            expect(stats).toEqual({ connected: false });
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('isAvailable', () => {
        it('should return true when connected', () => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
            expect(service.isAvailable()).toBe(true);
        });
        it('should return false when not connected', () => {
            service = new cacheService_1.CacheService();
            expect(service.isAvailable()).toBe(false);
        });
    });
    describe('disconnect', () => {
        beforeEach(() => {
            service = new cacheService_1.CacheService();
            const readyCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
            readyCallback();
        });
        it('should gracefully disconnect', async () => {
            await service.disconnect();
            expect(mockRedisClient.quit).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('disconnected gracefully'));
        });
        it('should handle disconnect errors', async () => {
            mockRedisClient.quit.mockRejectedValue(new Error('Disconnect error'));
            await service.disconnect();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('error handling', () => {
        it('should handle connection errors', () => {
            service = new cacheService_1.CacheService();
            const errorCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'error')[1];
            errorCallback(new Error('Connection failed'));
            expect(console.error).toHaveBeenCalledWith('Redis Client Error:', expect.any(Error));
        });
        it('should handle end event', () => {
            service = new cacheService_1.CacheService();
            const endCallback = mockRedisClient.on.mock.calls.find((call) => call[0] === 'end')[1];
            endCallback();
            expect(console.log).toHaveBeenCalledWith('Redis client disconnected');
        });
    });
});
