"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rxImageService = exports.RxImageService = void 0;
const config_1 = require("../config");
const cacheService_1 = require("./cacheService");
class RxImageService {
    baseUrl = config_1.config.RXIMAGE_BASE_URL;
    cacheTTL = config_1.config.CACHE_TTL_IMAGES; // 7 days for images
    /**
     * Get drug images by RxCUI
     */
    async getImagesByRxcui(rxcui) {
        if (!config_1.config.ENABLE_DRUG_IMAGES)
            return [];
        const cacheKey = `rxcui:${rxcui}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('image', cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const response = await fetch(`${this.baseUrl}/rximage?rxcui=${rxcui}&rLimit=5`);
            if (!response.ok) {
                console.error(`RxImage API error: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const images = data.nlmRxImages || [];
            // Cache the results
            if (images.length > 0) {
                await cacheService_1.cacheService.set('image', cacheKey, images, this.cacheTTL);
            }
            return images;
        }
        catch (error) {
            console.error('Error fetching drug images:', error);
            return [];
        }
    }
    /**
     * Get drug images by NDC (National Drug Code)
     */
    async getImagesByNdc(ndc) {
        if (!config_1.config.ENABLE_DRUG_IMAGES)
            return [];
        const cacheKey = `ndc:${ndc}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('image', cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const response = await fetch(`${this.baseUrl}/rximage?ndc=${ndc}`);
            if (!response.ok) {
                console.error(`RxImage API error: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const images = data.nlmRxImages || [];
            // Cache the results
            if (images.length > 0) {
                await cacheService_1.cacheService.set('image', cacheKey, images, this.cacheTTL);
            }
            return images;
        }
        catch (error) {
            console.error('Error fetching drug images:', error);
            return [];
        }
    }
    /**
     * Get drug images by name (text search)
     */
    async getImagesByName(name) {
        if (!config_1.config.ENABLE_DRUG_IMAGES)
            return [];
        const cacheKey = `name:${name.toLowerCase()}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('image', cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const response = await fetch(`${this.baseUrl}/rximage?name=${encodeURIComponent(name)}&rLimit=5`);
            if (!response.ok) {
                console.error(`RxImage API error: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const images = data.nlmRxImages || [];
            // Cache the results
            if (images.length > 0) {
                await cacheService_1.cacheService.set('image', cacheKey, images, this.cacheTTL);
            }
            return images;
        }
        catch (error) {
            console.error('Error fetching drug images:', error);
            return [];
        }
    }
}
exports.RxImageService = RxImageService;
exports.rxImageService = new RxImageService();
