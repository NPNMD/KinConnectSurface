// Drug API service for medication data
// Uses our backend API which integrates with RxNorm

import { apiClient } from './api';

export interface DrugConcept {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string; // Term type
  language?: string;
}

export interface DrugSearchResult {
  conceptGroup: {
    tty?: string;
    conceptProperties?: DrugConcept[];
  }[];
}

export interface DrugDetails {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
  language?: string;
  suppress?: string;
}

export interface DrugInteraction {
  minConceptItem: {
    rxcui: string;
    name: string;
    tty: string;
  };
  interactionTypeGroup: {
    sourceConceptItem: {
      id: string;
      name: string;
      url: string;
    };
    interactionType: {
      comment: string;
      minConcept: {
        rxcui: string;
        name: string;
        tty: string;
      }[];
    }[];
  }[];
}

class DrugApiService {

  /**
   * Search for drugs by name
   * @param query - Drug name to search for
   * @param maxEntries - Maximum number of results (default: 20)
   */
  async searchDrugs(query: string, maxEntries: number = 20): Promise<DrugConcept[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      const response = await apiClient.get<{ success: boolean; data: DrugConcept[] }>(
        `/drugs/search?q=${encodeURIComponent(query)}&limit=${maxEntries}`
      );

      return response.data || [];
    } catch (error) {
      console.error('Error searching drugs:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific drug by RXCUI
   * @param rxcui - RxNorm Concept Unique Identifier
   */
  async getDrugDetails(rxcui: string): Promise<DrugDetails | null> {
    try {
      const response = await apiClient.get<{ success: boolean; data: DrugDetails }>(
        `/drugs/${rxcui}`
      );

      return response.data || null;
    } catch (error) {
      console.error('Error getting drug details:', error);
      return null;
    }
  }

  /**
   * Get drug interactions for a specific medication
   * @param rxcui - RxNorm Concept Unique Identifier
   */
  async getDrugInteractions(rxcui: string): Promise<DrugInteraction[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: DrugInteraction[] }>(
        `/drugs/${rxcui}/interactions`
      );

      return response.data || [];
    } catch (error) {
      console.error('Error getting drug interactions:', error);
      return [];
    }
  }

  /**
   * Get spelling suggestions for a drug name
   * @param query - Potentially misspelled drug name
   */
  async getSpellingSuggestions(query: string): Promise<string[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: string[] }>(
        `/drugs/suggestions/${encodeURIComponent(query)}`
      );

      return response.data || [];
    } catch (error) {
      console.error('Error getting spelling suggestions:', error);
      return [];
    }
  }

  /**
   * Search for drugs by approximate match (useful for partial names)
   * @param query - Partial drug name
   * @param maxEntries - Maximum number of results
   */
  async searchDrugsApproximate(query: string, maxEntries: number = 20): Promise<DrugConcept[]> {
    // The server-side search already handles approximate matching as fallback
    return this.searchDrugs(query, maxEntries);
  }

  /**
   * Get all related drug concepts (brand names, generics, etc.)
   * @param rxcui - RxNorm Concept Unique Identifier
   */
  async getRelatedDrugs(rxcui: string): Promise<DrugConcept[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: DrugConcept[] }>(
        `/drugs/${rxcui}/related`
      );

      return response.data || [];
    } catch (error) {
      console.error('Error getting related drugs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const drugApiService = new DrugApiService();

// Helper function to format drug name for display
export function formatDrugName(concept: DrugConcept): string {
  return concept.name || concept.synonym || 'Unknown medication';
}

// Helper function to get drug strength/dosage info from name
export function extractDosageFromName(drugName: string): string {
  const dosageMatch = drugName.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
  return dosageMatch ? `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}` : '';
}