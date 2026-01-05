import request from 'supertest';
import express from 'express';
import { createDrugRouter } from '../drugs';

describe('Drug Routes', () => {
  let app: express.Application;
  let mockDrugService: any;
  let mockRxImageService: any;
  let mockDailyMedService: any;
  let mockAuthMiddleware: any;

  beforeEach(() => {
    mockDrugService = {
      searchDrugs: jest.fn(),
      getDrugDetails: jest.fn(),
      getDrugInteractions: jest.fn(),
      getSpellingSuggestions: jest.fn(),
      getRelatedDrugs: jest.fn()
    };

    mockRxImageService = {
      getImagesByRxcui: jest.fn(),
      getImagesByName: jest.fn()
    };

    mockDailyMedService = {
      searchDrug: jest.fn(),
      getDrugDetails: jest.fn()
    };

    mockAuthMiddleware = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      req.user = { uid: 'user-123' };
      next();
    };

    app = express();
    app.use(express.json());
    app.use('/drugs', createDrugRouter(
      mockDrugService,
      mockRxImageService,
      mockDailyMedService,
      mockAuthMiddleware
    ));

    jest.clearAllMocks();
  });

  describe('GET /drugs/test-search', () => {
    it('should search drugs without authentication', async () => {
      mockDrugService.searchDrugs.mockResolvedValue([
        { rxcui: '313782', name: 'Aspirin' }
      ]);

      const response = await request(app)
        .get('/drugs/test-search?q=aspirin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.testMode).toBe(true);
    });

    it('should return 400 for short query', async () => {
      const response = await request(app)
        .get('/drugs/test-search?q=a');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 2 characters');
    });

    it('should handle API errors', async () => {
      mockDrugService.searchDrugs.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/drugs/test-search?q=test');

      expect(response.status).toBe(503);
      expect(response.body.error).toContain('temporarily unavailable');
    });
  });

  describe('GET /drugs/search', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/drugs/search?q=aspirin');

      expect(response.status).toBe(401);
    });

    it('should search drugs with valid query', async () => {
      mockDrugService.searchDrugs.mockResolvedValue([
        { rxcui: '313782', name: 'Aspirin' }
      ]);

      const response = await request(app)
        .get('/drugs/search?q=aspirin')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDrugService.searchDrugs).toHaveBeenCalledWith('aspirin', 20);
    });

    it('should respect limit parameter', async () => {
      mockDrugService.searchDrugs.mockResolvedValue([]);

      await request(app)
        .get('/drugs/search?q=test&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(mockDrugService.searchDrugs).toHaveBeenCalledWith('test', 10);
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .get('/drugs/search')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /drugs/:rxcui', () => {
    it('should get drug details by rxcui', async () => {
      mockDrugService.getDrugDetails.mockResolvedValue({
        rxcui: '313782',
        name: 'Aspirin 81mg'
      });

      const response = await request(app)
        .get('/drugs/313782')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.rxcui).toBe('313782');
    });

    it('should return 404 for non-existent drug', async () => {
      mockDrugService.getDrugDetails.mockResolvedValue(null);

      const response = await request(app)
        .get('/drugs/999999')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid rxcui', async () => {
      const response = await request(app)
        .get('/drugs/invalid')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Valid RXCUI');
    });
  });

  describe('GET /drugs/:rxcui/interactions', () => {
    it('should get drug interactions', async () => {
      mockDrugService.getDrugInteractions.mockResolvedValue([
        { description: 'May increase bleeding risk' }
      ]);

      const response = await request(app)
        .get('/drugs/313782/interactions')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return empty array for no interactions', async () => {
      mockDrugService.getDrugInteractions.mockResolvedValue([]);

      const response = await request(app)
        .get('/drugs/313782/interactions')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /drugs/suggestions/:term', () => {
    it('should get spelling suggestions', async () => {
      mockDrugService.getSpellingSuggestions.mockResolvedValue(['aspirin']);

      const response = await request(app)
        .get('/drugs/suggestions/asprin')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toContain('aspirin');
    });

    it('should return 400 for short term', async () => {
      const response = await request(app)
        .get('/drugs/suggestions/a')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /drugs/:rxcui/related', () => {
    it('should get related drugs', async () => {
      mockDrugService.getRelatedDrugs.mockResolvedValue([
        { rxcui: '1191', name: 'Aspirin 325mg' }
      ]);

      const response = await request(app)
        .get('/drugs/313782/related')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /drugs/:rxcui/images', () => {
    it('should get drug images', async () => {
      mockRxImageService.getImagesByRxcui.mockResolvedValue([
        { imageUrl: 'http://example.com/image.jpg' }
      ]);

      const response = await request(app)
        .get('/drugs/313782/images')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /drugs/images/search', () => {
    it('should search images by name', async () => {
      mockRxImageService.getImagesByName.mockResolvedValue([
        { imageUrl: 'http://example.com/aspirin.jpg' }
      ]);

      const response = await request(app)
        .get('/drugs/images/search?name=Aspirin')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 400 for missing name parameter', async () => {
      const response = await request(app)
        .get('/drugs/images/search')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /drugs/:rxcui/clinical-info', () => {
    it('should get clinical information', async () => {
      mockDrugService.getDrugDetails.mockResolvedValue({
        name: 'Aspirin 81mg'
      });
      mockDailyMedService.searchDrug.mockResolvedValue([
        { setid: '123', title: 'Aspirin' }
      ]);
      mockDailyMedService.getDrugDetails.mockResolvedValue({
        setid: '123',
        indications: 'Pain relief'
      });

      const response = await request(app)
        .get('/drugs/313782/clinical-info')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.indications).toBe('Pain relief');
    });

    it('should return no info message when not available', async () => {
      mockDrugService.getDrugDetails.mockResolvedValue({
        name: 'Test Drug'
      });
      mockDailyMedService.searchDrug.mockResolvedValue([]);

      const response = await request(app)
        .get('/drugs/313782/clinical-info')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toContain('No clinical information');
    });
  });
});
