import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { rxImageService } from '../services/rxImageService';
import { dailyMedService } from '../services/dailyMedService';
import { makeRxNormRequest } from '../services/rxnormService';

const router = Router();

// Get drug images by RXCUI
router.get('/:rxcui/images', authenticate, async (req, res) => {
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
router.get('/images/search', authenticate, async (req, res) => {
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
router.get('/:rxcui/clinical-info', authenticate, async (req, res) => {
  try {
    const { rxcui } = req.params;
    
    // First, get drug name from RxNorm
    const drugDetails = await makeRxNormRequest(`/rxcui/${rxcui}/properties.json`) as any;
    const drugName = drugDetails.propConceptGroup?.propConcept?.[0]?.name;
    
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

export default router;
