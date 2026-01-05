import { DailyMedService } from '../dailyMedService';
import { createMockFetch, mockConsole } from '../../__tests__/testUtils';

const mockCacheService = {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve())
};

jest.mock('../cacheService', () => ({
  cacheService: mockCacheService
}));

jest.mock('../../config', () => ({
  config: {
    DAILYMED_BASE_URL: 'https://dailymed.nlm.nih.gov/dailymed',
    CACHE_TTL_DRUG_DATA: 86400,
    ENABLE_CLINICAL_INFO: true
  }
}));

mockConsole();

describe('DailyMedService', () => {
  let service: DailyMedService;
  let originalFetch: any;

  beforeEach(() => {
    service = new DailyMedService();
    originalFetch = global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('searchDrug', () => {
    it('should return cached results if available', async () => {
      const cachedData = [{ setid: '123', title: 'Aspirin' }];
      mockCacheService.get.mockResolvedValueOnce(cachedData);

      const result = await service.searchDrug('aspirin');

      expect(mockCacheService.get).toHaveBeenCalledWith('dailymed', 'search:aspirin');
      expect(result).toEqual(cachedData);
    });

    it('should fetch drug search results and cache', async () => {
      const apiResponse = {
        data: [
          { setid: '123', title: 'Aspirin 81mg', published_date: '2024-01-01', splDocType: 'HUMAN PRESCRIPTION DRUG LABEL' }
        ]
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.searchDrug('aspirin');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/spls.json?drug=aspirin')
      );
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should return empty array when disabled', async () => {
      jest.doMock('../../config', () => ({
        config: { ENABLE_CLINICAL_INFO: false }
      }));

      const { DailyMedService } = require('../dailyMedService');
      const disabledService = new DailyMedService();

      const result = await disabledService.searchDrug('aspirin');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: false,
        status: 500
      }));

      const result = await service.searchDrug('test');

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getDrugDetails', () => {
    it('should return cached details if available', async () => {
      const cachedDetails = { setid: '123', title: 'Aspirin' };
      mockCacheService.get.mockResolvedValueOnce(cachedDetails);

      const result = await service.getDrugDetails('123');

      expect(mockCacheService.get).toHaveBeenCalledWith('dailymed', 'details:123');
      expect(result).toEqual(cachedDetails);
    });

    it('should fetch and extract drug details', async () => {
      const apiResponse = {
        data: {
          setid: '123',
          title: 'Aspirin 81mg',
          indications_and_usage: '<p>For pain relief</p>',
          dosage_and_administration: '<p>Take one tablet daily</p>',
          warnings_and_cautions: '<p>May cause bleeding</p>'
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('123');

      expect(result).toBeDefined();
      expect(result?.setid).toBe('123');
      expect(result?.indications).toContain('pain relief');
      expect(result?.dosage).toContain('one tablet');
    });

    it('should handle missing sections', async () => {
      const apiResponse = {
        data: {
          setid: '123',
          title: 'Test Drug'
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('123');

      expect(result?.indications).toBeUndefined();
      expect(result?.warnings).toBeUndefined();
    });

    it('should return null on error', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      const result = await service.getDrugDetails('123');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('extractSection', () => {
    it('should clean HTML tags', async () => {
      const apiResponse = {
        data: {
          setid: '123',
          title: 'Test',
          indications_and_usage: '<p>Test <b>content</b></p>'
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('123');

      expect(result?.indications).not.toContain('<p>');
      expect(result?.indications).not.toContain('<b>');
    });

    it('should decode HTML entities', async () => {
      const apiResponse = {
        data: {
          setid: '123',
          title: 'Test',
          indications_and_usage: 'Test&nbsp;&lt;&gt;&amp;'
        }
      };

      global.fetch = createMockFetch(apiResponse);

      const result = await service.getDrugDetails('123');

      expect(result?.indications).toContain(' ');
      expect(result?.indications).not.toContain('&nbsp;');
    });
  });
});
