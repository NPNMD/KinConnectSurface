import { config } from '../config';
import { cacheService } from './cacheService';

interface DrugImage {
  imageUrl: string;
  ndc?: string;
  name: string;
  labeler?: string;
}

export class RxImageService {
  private baseUrl = config.RXIMAGE_BASE_URL;
  private cacheTTL = config.CACHE_TTL_IMAGES; // 7 days for images
  
  /**
   * Get drug images by RxCUI
   */
  async getImagesByRxcui(rxcui: string): Promise<DrugImage[]> {
    if (!config.ENABLE_DRUG_IMAGES) return [];

    const cacheKey = `rxcui:${rxcui}`;

    // Check cache first
    const cached = await cacheService.get<DrugImage[]>('image', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?rxcui=${rxcui}&rLimit=5`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json() as any;
      const images = data.nlmRxImages || [];

      // Cache the results
      if (images.length > 0) {
        await cacheService.set('image', cacheKey, images, this.cacheTTL);
      }

      return images;
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
  
  /**
   * Get drug images by NDC (National Drug Code)
   */
  async getImagesByNdc(ndc: string): Promise<DrugImage[]> {
    if (!config.ENABLE_DRUG_IMAGES) return [];

    const cacheKey = `ndc:${ndc}`;

    // Check cache first
    const cached = await cacheService.get<DrugImage[]>('image', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?ndc=${ndc}`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json() as any;
      const images = data.nlmRxImages || [];

      // Cache the results
      if (images.length > 0) {
        await cacheService.set('image', cacheKey, images, this.cacheTTL);
      }

      return images;
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
  
  /**
   * Get drug images by name (text search)
   */
  async getImagesByName(name: string): Promise<DrugImage[]> {
    if (!config.ENABLE_DRUG_IMAGES) return [];

    const cacheKey = `name:${name.toLowerCase()}`;

    // Check cache first
    const cached = await cacheService.get<DrugImage[]>('image', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?name=${encodeURIComponent(name)}&rLimit=5`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json() as any;
      const images = data.nlmRxImages || [];

      // Cache the results
      if (images.length > 0) {
        await cacheService.set('image', cacheKey, images, this.cacheTTL);
      }

      return images;
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
}

export const rxImageService = new RxImageService();
