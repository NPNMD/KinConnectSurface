import { Router } from 'express';
import { DrugService } from '../../shared/services/drugService';
import { RxImageService } from '../../shared/services/rxImageService';
import { DailyMedService } from '../../shared/services/dailyMedService';

export function createDrugRouter(
  drugService: DrugService,
  rxImageService: RxImageService,
  dailyMedService: DailyMedService,
  authenticateToken: any
) {
  const router = Router();

  // Test search route without authentication (for testing purposes)
  router.get('/test-search', async (req: any, res: any) => {
    try {
      const { q: query, limit = '20' } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required and must be at least 2 characters long'
        });
      }

      const limitNum = parseInt(limit as string) || 20;
      const results = await drugService.searchDrugs(query, limitNum);

      res.json({
        success: true,
        data: results,
        message: `Found ${results.length} drug(s)`,
        testMode: true
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug search service temporarily unavailable'
      });
    }
  });

  // Search for drugs by name
  router.get('/search', authenticateToken, async (req: any, res: any) => {
    try {
      const { q: query, limit = '20' } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required and must be at least 2 characters long'
        });
      }

      const limitNum = parseInt(limit as string) || 20;
      const results = await drugService.searchDrugs(query, limitNum);

      res.json({
        success: true,
        data: results,
        message: `Found ${results.length} drug(s)`
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug search service temporarily unavailable'
      });
    }
  });

  // Get drug details by RXCUI
  router.get('/:rxcui', authenticateToken, async (req: any, res: any) => {
    try {
      const { rxcui } = req.params;
      
      if (!rxcui || !/^\d+$/.test(rxcui)) {
        return res.status(400).json({
          success: false,
          error: 'Valid RXCUI is required'
        });
      }

      const drugDetails = await drugService.getDrugDetails(rxcui);

      if (!drugDetails) {
        return res.status(404).json({
          success: false,
          error: 'Drug not found'
        });
      }

      res.json({
        success: true,
        data: drugDetails,
        message: 'Drug details retrieved successfully'
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug details service temporarily unavailable'
      });
    }
  });

  // Get drug interactions by RXCUI
  router.get('/:rxcui/interactions', authenticateToken, async (req: any, res: any) => {
    try {
      const { rxcui } = req.params;
      
      if (!rxcui || !/^\d+$/.test(rxcui)) {
        return res.status(400).json({
          success: false,
          error: 'Valid RXCUI is required'
        });
      }

      const interactions = await drugService.getDrugInteractions(rxcui);

      res.json({
        success: true,
        data: interactions,
        message: `Found ${interactions.length} interaction(s)`
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug interactions service temporarily unavailable'
      });
    }
  });

  // Get spelling suggestions for drug names
  router.get('/suggestions/:term', authenticateToken, async (req: any, res: any) => {
    try {
      const { term } = req.params;
      
      if (!term || term.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search term must be at least 2 characters long'
        });
      }

      const suggestions = await drugService.getSpellingSuggestions(term);

      res.json({
        success: true,
        data: suggestions,
        message: `Found ${suggestions.length} suggestion(s)`
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Spelling suggestions service temporarily unavailable'
      });
    }
  });

  // Get related drugs (brand names, generics, etc.) by RXCUI
  router.get('/:rxcui/related', authenticateToken, async (req: any, res: any) => {
    try {
      const { rxcui } = req.params;
      
      if (!rxcui || !/^\d+$/.test(rxcui)) {
        return res.status(400).json({
          success: false,
          error: 'Valid RXCUI is required'
        });
      }

      const related = await drugService.getRelatedDrugs(rxcui);

      res.json({
        success: true,
        data: related,
        message: `Found ${related.length} related drug(s)`
      });

    } catch (apiError) {
      console.error('Drug API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Related drugs service temporarily unavailable'
      });
    }
  });

  // Get drug images by RXCUI
  router.get('/:rxcui/images', authenticateToken, async (req: any, res: any) => {
    try {
      const { rxcui } = req.params;
      
      if (!rxcui || !/^\d+$/.test(rxcui)) {
        return res.status(400).json({
          success: false,
          error: 'Valid RXCUI is required'
        });
      }
      
      const images = await rxImageService.getImagesByRxcui(rxcui);
      
      res.json({
        success: true,
        data: images,
        message: `Found ${images.length} image(s)`
      });
    } catch (error) {
      console.error('Error getting drug images:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Search images by drug name
  router.get('/images/search', authenticateToken, async (req: any, res: any) => {
    try {
      const { name } = req.query;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Drug name is required'
        });
      }
      
      const images = await rxImageService.getImagesByName(name);
      
      res.json({
        success: true,
        data: images,
        message: `Found ${images.length} image(s)`
      });
    } catch (error) {
      console.error('Error searching drug images:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Get clinical information for a drug
  router.get('/:rxcui/clinical-info', authenticateToken, async (req: any, res: any) => {
    try {
      const { rxcui } = req.params;
      
      // First, get drug name from RxNorm
      const drugDetails = await drugService.getDrugDetails(rxcui);
      const drugName = drugDetails?.name;
      
      if (!drugName) {
        return res.status(404).json({
          success: false,
          error: 'Drug not found'
        });
      }
      
      // Search DailyMed
      const products = await dailyMedService.searchDrug(drugName);
      
      if (products.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No clinical information available'
        });
      }
      
      // Get details for the first matching product
      const details = await dailyMedService.getDrugDetails(products[0].setid);
      
      res.json({
        success: true,
        data: details,
        message: 'Clinical information retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting clinical info:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  return router;
}
