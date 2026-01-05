// RxNorm API base URL
import { config } from '../config';
import { cacheService } from './cacheService';

export class DrugService {
  private baseUrl = config.RXNORM_BASE_URL;
  private cacheTTL = config.CACHE_TTL_DRUG_DATA;

  // Helper function to make requests to RxNorm API
  private async makeRxNormRequest(endpoint: string) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('RxNorm API request failed:', error);
      throw error;
    }
  }

  async searchDrugs(query: string, limit: number = 20) {
    const maxEntries = Math.min(limit, 50);
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;

    // Check cache first
    const cached = await cacheService.get<any[]>('drug', cacheKey);
    if (cached) {
      return cached;
    }

    // First try exact search
    const searchResponse = await this.makeRxNormRequest(
      `/drugs.json?name=${encodeURIComponent(query.trim())}`
    ) as any;

    let concepts: any[] = [];
    
    if (searchResponse.drugGroup?.conceptGroup) {
      searchResponse.drugGroup.conceptGroup.forEach((group: any) => {
        if (group.conceptProperties) {
          concepts.push(...group.conceptProperties);
        }
      });
    }

    // If no results, try approximate search
    if (concepts.length === 0) {
      const approximateResponse = await this.makeRxNormRequest(
        `/approximateTerm.json?term=${encodeURIComponent(query.trim())}&maxEntries=${maxEntries}`
      ) as any;

      if (approximateResponse.approximateGroup?.candidate) {
        concepts = approximateResponse.approximateGroup.candidate;
      }
    }

    // Remove duplicates and limit results
    const uniqueConcepts = concepts
      .filter((concept: any, index: number, self: any[]) =>
        index === self.findIndex((c: any) => c.rxcui === concept.rxcui)
      )
      .slice(0, maxEntries);

    // Cache the results
    await cacheService.set('drug', cacheKey, uniqueConcepts, this.cacheTTL);

    return uniqueConcepts;
  }

  async getDrugDetails(rxcui: string) {
    const cacheKey = `rxcui:${rxcui}`;

    // Check cache first
    const cached = await cacheService.get<any>('drug', cacheKey);
    if (cached) {
      return cached;
    }

    const detailsResponse = await this.makeRxNormRequest(
      `/rxcui/${rxcui}/properties.json`
    ) as any;

    const details = detailsResponse.propConceptGroup?.propConcept?.[0] || null;

    // Cache the results
    if (details) {
      await cacheService.set('drug', cacheKey, details, this.cacheTTL);
    }

    return details;
  }

  async getDrugInteractions(rxcui: string) {
    const cacheKey = `interactions:${rxcui}`;

    // Check cache first
    const cached = await cacheService.get<any[]>('drug', cacheKey);
    if (cached) {
      return cached;
    }

    const interactionsResponse = await this.makeRxNormRequest(
      `/interaction/interaction.json?rxcui=${rxcui}`
    ) as any;

    const interactions = interactionsResponse.interactionTypeGroup || [];

    // Cache the results
    await cacheService.set('drug', cacheKey, interactions, this.cacheTTL);

    return interactions;
  }

  async getSpellingSuggestions(term: string) {
    const cacheKey = `spelling:${term.toLowerCase()}`;

    // Check cache first
    const cached = await cacheService.get<string[]>('drug', cacheKey);
    if (cached) {
      return cached;
    }

    const suggestionsResponse = await this.makeRxNormRequest(
      `/spellingsuggestions.json?name=${encodeURIComponent(term.trim())}`
    ) as any;

    const suggestions = suggestionsResponse.suggestionGroup?.suggestionList?.suggestion || [];

    // Cache the results
    await cacheService.set('drug', cacheKey, suggestions, this.cacheTTL);

    return suggestions;
  }

  async getRelatedDrugs(rxcui: string) {
    const cacheKey = `related:${rxcui}`;

    // Check cache first
    const cached = await cacheService.get<any[]>('drug', cacheKey);
    if (cached) {
      return cached;
    }

    const relatedResponse = await this.makeRxNormRequest(
      `/rxcui/${rxcui}/related.json?tty=SBD+SCD+GPCK+BPCK`
    ) as any;

    let concepts: any[] = [];
    
    if (relatedResponse.relatedGroup?.conceptGroup) {
      relatedResponse.relatedGroup.conceptGroup.forEach((group: any) => {
        if (group.conceptProperties) {
          concepts.push(...group.conceptProperties);
        }
      });
    }

    // Cache the results
    await cacheService.set('drug', cacheKey, concepts, this.cacheTTL);

    return concepts;
  }
}

export const drugService = new DrugService();
