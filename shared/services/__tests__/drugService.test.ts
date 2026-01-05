import { DrugService } from '../drugService';
import { createMockFetch, mockConsole } from '../../__tests__/testUtils';

// Mock cacheService
const mockCacheService = {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve())
};

jest.mock('../cacheService', () => ({
  cacheService: mockCacheService
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    RXNORM_BASE_URL: 'https://rxnav.nlm.nih.gov/REST',
    CACHE_TTL_DRUG_DATA: 86400
  }
}));

mockConsole();

describe('DrugService', () => {
  let service: DrugService;
  let originalFetch: any;

  beforeEach(() => {
    service = new DrugService();
    originalFetch = global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('searchDrugs', () => {
    it('should return cached results if available', async () => {
      const cachedResults = [{ rxcui: '313782', name: 'Aspirin' }];
      mockCacheService.get.mockResolvedValueOnce(cachedResults);

      const results = await service.searchDrugs('aspirin');

      expect(mockCacheService.get).toHaveBeenCalledWith('drug', 'search:aspirin:20');
      expect(results).toEqual(cachedResults);
      expect(global.fetch).toBeUndefined();
    });

    it('should search drugs from API and cache results', async () => {
      const apiResponse = {
        drugGroup: {
          conceptGroup: [
            {
              conceptProperties: [
                { rxcui: '313782', name: 'Aspirin 81mg', synonym: 'Aspirin', tty: 'SCD' }
              ]
            }
          ]
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const results = await service.searchDrugs('aspirin', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/drugs.json?name=aspirin')
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'drug',
        'search:aspirin:10',
        expect.any(Array),
        86400
      );
      expect(results).toHaveLength(1);
      expect(results[0].rxcui).toBe('313782');
    });

    it('should try approximate search if exact search returns no results', async () => {
      const emptyResponse = { drugGroup: {} };
      const approximateResponse = {
        approximateGroup: {
          candidate: [
            { rxcui: '313782', name: 'Aspirin', score: '100' }
          ]
        }
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(emptyResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(approximateResponse)
        });

      const results = await service.searchDrugs('asprin'); // misspelled

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/approximateTerm.json')
      );
      expect(results).toHaveLength(1);
    });

    it('should remove duplicates and limit results', async () => {
      const apiResponse = {
        drugGroup: {
          conceptGroup: [
            {
              conceptProperties: [
                { rxcui: '313782', name: 'Aspirin 81mg' },
                { rxcui: '313782', name: 'Aspirin 81mg' }, // duplicate
                { rxcui: '1191', name: 'Aspirin 325mg' }
              ]
            }
          ]
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const results = await service.searchDrugs('aspirin');

      expect(results).toHaveLength(2); // duplicates removed
      expect(results[0].rxcui).toBe('313782');
      expect(results[1].rxcui).toBe('1191');
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }));

      await expect(service.searchDrugs('aspirin')).rejects.toThrow('RxNorm API error');
      expect(console.error).toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      const apiResponse = { drugGroup: {} };
      const approximateResponse = {
        approximateGroup: {
          candidate: Array.from({ length: 60 }, (_, i) => ({
            rxcui: `${i}`,
            name: `Drug ${i}`
          }))
        }
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(apiResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(approximateResponse)
        });

      const results = await service.searchDrugs('test', 25);

      expect(results.length).toBeLessThanOrEqual(25);
    });
  });

  describe('getDrugDetails', () => {
    it('should return cached details if available', async () => {
      const cachedDetails = { rxcui: '313782', name: 'Aspirin' };
      mockCacheService.get.mockResolvedValueOnce(cachedDetails);

      const result = await service.getDrugDetails('313782');

      expect(mockCacheService.get).toHaveBeenCalledWith('drug', 'rxcui:313782');
      expect(result).toEqual(cachedDetails);
    });

    it('should fetch drug details from API and cache', async () => {
      const apiResponse = {
        propConceptGroup: {
          propConcept: [
            { rxcui: '313782', name: 'Aspirin 81mg', tty: 'SCD' }
          ]
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('313782');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rxcui/313782/properties.json')
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'drug',
        'rxcui:313782',
        expect.any(Object),
        86400
      );
      expect(result.rxcui).toBe('313782');
    });

    it('should return null if no details found', async () => {
      const apiResponse = { propConceptGroup: {} };
      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('999999');

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('getDrugInteractions', () => {
    it('should return cached interactions if available', async () => {
      const cachedInteractions = [{ description: 'Test interaction' }];
      mockCacheService.get.mockResolvedValueOnce(cachedInteractions);

      const result = await service.getDrugInteractions('313782');

      expect(mockCacheService.get).toHaveBeenCalledWith('drug', 'interactions:313782');
      expect(result).toEqual(cachedInteractions);
    });

    it('should fetch interactions from API and cache', async () => {
      const apiResponse = {
        interactionTypeGroup: [
          {
            sourceConceptItem: { name: 'Aspirin' },
            interactionType: [
              {
                minConceptItem: { name: 'Warfarin' },
                interactionPair: [
                  { description: 'May increase bleeding risk' }
                ]
              }
            ]
          }
        ]
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugInteractions('313782');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/interaction/interaction.json?rxcui=313782')
      );
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should return empty array if no interactions', async () => {
      const apiResponse = {};
      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugInteractions('313782');

      expect(result).toEqual([]);
    });
  });

  describe('getSpellingSuggestions', () => {
    it('should return cached suggestions if available', async () => {
      const cachedSuggestions = ['aspirin', 'asprin'];
      mockCacheService.get.mockResolvedValueOnce(cachedSuggestions);

      const result = await service.getSpellingSuggestions('asprin');

      expect(result).toEqual(cachedSuggestions);
    });

    it('should fetch spelling suggestions and cache', async () => {
      const apiResponse = {
        suggestionGroup: {
          suggestionList: {
            suggestion: ['aspirin', 'aspirin 81mg']
          }
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getSpellingSuggestions('asprin');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/spellingsuggestions.json?name=asprin')
      );
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result).toEqual(['aspirin', 'aspirin 81mg']);
    });

    it('should return empty array if no suggestions', async () => {
      const apiResponse = { suggestionGroup: {} };
      global.fetch = createMockFetch(apiResponse);

      const result = await service.getSpellingSuggestions('xyz123');

      expect(result).toEqual([]);
    });
  });

  describe('getRelatedDrugs', () => {
    it('should return cached related drugs if available', async () => {
      const cachedRelated = [{ rxcui: '1191', name: 'Aspirin 325mg' }];
      mockCacheService.get.mockResolvedValueOnce(cachedRelated);

      const result = await service.getRelatedDrugs('313782');

      expect(result).toEqual(cachedRelated);
    });

    it('should fetch related drugs and cache', async () => {
      const apiResponse = {
        relatedGroup: {
          conceptGroup: [
            {
              conceptProperties: [
                { rxcui: '1191', name: 'Aspirin 325mg', tty: 'SCD' },
                { rxcui: '1295740', name: 'Bayer Aspirin', tty: 'SBD' }
              ]
            }
          ]
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getRelatedDrugs('313782');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rxcui/313782/related.json?tty=SBD+SCD+GPCK+BPCK')
      );
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no related drugs', async () => {
      const apiResponse = { relatedGroup: {} };
      global.fetch = createMockFetch(apiResponse);

      const result = await service.getRelatedDrugs('999999');

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      await expect(service.searchDrugs('test')).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle malformed API responses', async () => {
      global.fetch = createMockFetch(null);

      await expect(service.searchDrugs('test')).rejects.toThrow();
    });
  });
});
