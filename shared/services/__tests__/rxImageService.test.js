"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxImageService_1 = require("../rxImageService");
const testUtils_1 = require("../../__tests__/testUtils");
// Mock cacheService
const mockCacheService = {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve())
};
jest.mock('../cacheService', () => ({
    cacheService: mockCacheService
}));
jest.mock('../../config', () => ({
    config: {
        RXIMAGE_BASE_URL: 'https://rximage.nlm.nih.gov/api',
        CACHE_TTL_IMAGES: 604800,
        ENABLE_DRUG_IMAGES: true
    }
}));
(0, testUtils_1.mockConsole)();
describe('RxImageService', () => {
    let service;
    let originalFetch;
    beforeEach(() => {
        service = new rxImageService_1.RxImageService();
        originalFetch = global.fetch;
        jest.clearAllMocks();
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });
    describe('getImagesByRxcui', () => {
        it('should return cached images if available', async () => {
            const cachedImages = [{ imageUrl: 'test.jpg', name: 'Aspirin' }];
            mockCacheService.get.mockResolvedValueOnce(cachedImages);
            const result = await service.getImagesByRxcui('313782');
            expect(mockCacheService.get).toHaveBeenCalledWith('image', 'rxcui:313782');
            expect(result).toEqual(cachedImages);
        });
        it('should fetch images from API and cache', async () => {
            const apiResponse = {
                nlmRxImages: [
                    { imageUrl: 'http://example.com/image1.jpg', name: 'Aspirin 81mg' },
                    { imageUrl: 'http://example.com/image2.jpg', name: 'Aspirin 81mg' }
                ]
            };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            const result = await service.getImagesByRxcui('313782');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/rximage?rxcui=313782&rLimit=5'));
            expect(mockCacheService.set).toHaveBeenCalledWith('image', 'rxcui:313782', apiResponse.nlmRxImages, 604800);
            expect(result).toHaveLength(2);
        });
        it('should return empty array when no images found', async () => {
            const apiResponse = { nlmRxImages: [] };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            const result = await service.getImagesByRxcui('999999');
            expect(result).toEqual([]);
            expect(mockCacheService.set).not.toHaveBeenCalled();
        });
        it('should return empty array when drug images disabled', async () => {
            jest.doMock('../../config', () => ({
                config: { ENABLE_DRUG_IMAGES: false }
            }));
            const { RxImageService } = require('../rxImageService');
            const disabledService = new RxImageService();
            const result = await disabledService.getImagesByRxcui('313782');
            expect(result).toEqual([]);
        });
        it('should handle API errors gracefully', async () => {
            global.fetch = jest.fn(() => Promise.resolve({
                ok: false,
                status: 500
            }));
            const result = await service.getImagesByRxcui('313782');
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
        it('should handle network errors', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
            const result = await service.getImagesByRxcui('313782');
            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('getImagesByNdc', () => {
        it('should fetch images by NDC code', async () => {
            const apiResponse = {
                nlmRxImages: [
                    { imageUrl: 'http://example.com/image.jpg', ndc: '12345-678-90' }
                ]
            };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            const result = await service.getImagesByNdc('12345-678-90');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/rximage?ndc=12345-678-90'));
            expect(result).toHaveLength(1);
        });
        it('should cache results by NDC', async () => {
            const apiResponse = {
                nlmRxImages: [{ imageUrl: 'test.jpg' }]
            };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            await service.getImagesByNdc('12345-678-90');
            expect(mockCacheService.set).toHaveBeenCalledWith('image', 'ndc:12345-678-90', expect.any(Array), 604800);
        });
    });
    describe('getImagesByName', () => {
        it('should fetch images by drug name', async () => {
            const apiResponse = {
                nlmRxImages: [
                    { imageUrl: 'http://example.com/aspirin.jpg', name: 'Aspirin' }
                ]
            };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            const result = await service.getImagesByName('Aspirin');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/rximage?name=Aspirin&rLimit=5'));
            expect(result).toHaveLength(1);
        });
        it('should cache results by lowercase name', async () => {
            const apiResponse = {
                nlmRxImages: [{ imageUrl: 'test.jpg' }]
            };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            await service.getImagesByName('Aspirin');
            expect(mockCacheService.set).toHaveBeenCalledWith('image', 'name:aspirin', expect.any(Array), 604800);
        });
        it('should handle special characters in name', async () => {
            const apiResponse = { nlmRxImages: [] };
            global.fetch = (0, testUtils_1.createMockFetch)(apiResponse);
            await service.getImagesByName('Drug & Medicine');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Drug & Medicine')));
        });
    });
});
