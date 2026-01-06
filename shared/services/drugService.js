"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drugService = exports.DrugService = void 0;
// RxNorm API base URL
const config_1 = require("../config");
const cacheService_1 = require("./cacheService");
class DrugService {
    baseUrl = config_1.config.RXNORM_BASE_URL;
    cacheTTL = config_1.config.CACHE_TTL_DRUG_DATA;
    // Helper function to make requests to RxNorm API
    async makeRxNormRequest(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            if (!response.ok) {
                throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('RxNorm API request failed:', error);
            throw error;
        }
    }
    async searchDrugs(query, limit = 20) {
        const maxEntries = Math.min(limit, 50);
        const cacheKey = `search:${query.toLowerCase()}:${limit}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('drug', cacheKey);
        if (cached) {
            return cached;
        }
        // First try exact search
        const searchResponse = await this.makeRxNormRequest(`/drugs.json?name=${encodeURIComponent(query.trim())}`);
        let concepts = [];
        if (searchResponse.drugGroup?.conceptGroup) {
            searchResponse.drugGroup.conceptGroup.forEach((group) => {
                if (group.conceptProperties) {
                    concepts.push(...group.conceptProperties);
                }
            });
        }
        // If no results, try approximate search
        if (concepts.length === 0) {
            const approximateResponse = await this.makeRxNormRequest(`/approximateTerm.json?term=${encodeURIComponent(query.trim())}&maxEntries=${maxEntries}`);
            if (approximateResponse.approximateGroup?.candidate) {
                concepts = approximateResponse.approximateGroup.candidate;
            }
        }
        // Remove duplicates and limit results
        const uniqueConcepts = concepts
            .filter((concept, index, self) => index === self.findIndex((c) => c.rxcui === concept.rxcui))
            .slice(0, maxEntries);
        // Cache the results
        await cacheService_1.cacheService.set('drug', cacheKey, uniqueConcepts, this.cacheTTL);
        return uniqueConcepts;
    }
    async getDrugDetails(rxcui) {
        const cacheKey = `rxcui:${rxcui}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('drug', cacheKey);
        if (cached) {
            return cached;
        }
        const detailsResponse = await this.makeRxNormRequest(`/rxcui/${rxcui}/properties.json`);
        const details = detailsResponse.propConceptGroup?.propConcept?.[0] || null;
        // Cache the results
        if (details) {
            await cacheService_1.cacheService.set('drug', cacheKey, details, this.cacheTTL);
        }
        return details;
    }
    async getDrugInteractions(rxcui) {
        const cacheKey = `interactions:${rxcui}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('drug', cacheKey);
        if (cached) {
            return cached;
        }
        const interactionsResponse = await this.makeRxNormRequest(`/interaction/interaction.json?rxcui=${rxcui}`);
        const interactions = interactionsResponse.interactionTypeGroup || [];
        // Cache the results
        await cacheService_1.cacheService.set('drug', cacheKey, interactions, this.cacheTTL);
        return interactions;
    }
    async getSpellingSuggestions(term) {
        const cacheKey = `spelling:${term.toLowerCase()}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('drug', cacheKey);
        if (cached) {
            return cached;
        }
        const suggestionsResponse = await this.makeRxNormRequest(`/spellingsuggestions.json?name=${encodeURIComponent(term.trim())}`);
        const suggestions = suggestionsResponse.suggestionGroup?.suggestionList?.suggestion || [];
        // Cache the results
        await cacheService_1.cacheService.set('drug', cacheKey, suggestions, this.cacheTTL);
        return suggestions;
    }
    async getRelatedDrugs(rxcui) {
        const cacheKey = `related:${rxcui}`;
        // Check cache first
        const cached = await cacheService_1.cacheService.get('drug', cacheKey);
        if (cached) {
            return cached;
        }
        const relatedResponse = await this.makeRxNormRequest(`/rxcui/${rxcui}/related.json?tty=SBD+SCD+GPCK+BPCK`);
        let concepts = [];
        if (relatedResponse.relatedGroup?.conceptGroup) {
            relatedResponse.relatedGroup.conceptGroup.forEach((group) => {
                if (group.conceptProperties) {
                    concepts.push(...group.conceptProperties);
                }
            });
        }
        // Cache the results
        await cacheService_1.cacheService.set('drug', cacheKey, concepts, this.cacheTTL);
        return concepts;
    }
}
exports.DrugService = DrugService;
exports.drugService = new DrugService();
