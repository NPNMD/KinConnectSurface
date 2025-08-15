import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// RxNorm API base URL
const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

// Helper function to make requests to RxNorm API
async function makeRxNormRequest(endpoint: string) {
  try {
    const response = await fetch(`${RXNORM_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('RxNorm API request failed:', error);
    throw error;
  }
}

// Test search route without authentication (for testing purposes)
router.get('/test-search', async (req, res) => {
  try {
    const { q: query, limit = '20' } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required and must be at least 2 characters long'
      });
    }

    const maxEntries = Math.min(parseInt(limit as string) || 20, 50); // Limit to 50 max

    try {
      // First try exact search
      const searchResponse = await makeRxNormRequest(
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
        const approximateResponse = await makeRxNormRequest(
          `/approximateTerm.json?term=${encodeURIComponent(query.trim())}&maxEntries=${maxEntries}`
        ) as any;

        if (approximateResponse.approximateGroup?.candidate) {
          concepts = approximateResponse.approximateGroup.candidate;
        }
      }

      // Remove duplicates and limit results
      const uniqueConcepts = concepts
        .filter((concept, index, self) =>
          index === self.findIndex(c => c.rxcui === concept.rxcui)
        )
        .slice(0, maxEntries);

      res.json({
        success: true,
        data: uniqueConcepts,
        message: `Found ${uniqueConcepts.length} drug(s)`,
        testMode: true
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug search service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Search for drugs by name
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q: query, limit = '20' } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required and must be at least 2 characters long'
      });
    }

    const maxEntries = Math.min(parseInt(limit as string) || 20, 50); // Limit to 50 max

    try {
      // First try exact search
      const searchResponse = await makeRxNormRequest(
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
        const approximateResponse = await makeRxNormRequest(
          `/approximateTerm.json?term=${encodeURIComponent(query.trim())}&maxEntries=${maxEntries}`
        ) as any;

        if (approximateResponse.approximateGroup?.candidate) {
          concepts = approximateResponse.approximateGroup.candidate;
        }
      }

      // Remove duplicates and limit results
      const uniqueConcepts = concepts
        .filter((concept, index, self) => 
          index === self.findIndex(c => c.rxcui === concept.rxcui)
        )
        .slice(0, maxEntries);

      res.json({
        success: true,
        data: uniqueConcepts,
        message: `Found ${uniqueConcepts.length} drug(s)`
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug search service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get drug details by RXCUI
router.get('/:rxcui', authenticateToken, async (req, res) => {
  try {
    const { rxcui } = req.params;
    
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      return res.status(400).json({
        success: false,
        error: 'Valid RXCUI is required'
      });
    }

    try {
      const detailsResponse = await makeRxNormRequest(
        `/rxcui/${rxcui}/properties.json`
      ) as any;

      if (!detailsResponse.propConceptGroup?.propConcept?.[0]) {
        return res.status(404).json({
          success: false,
          error: 'Drug not found'
        });
      }

      const drugDetails = detailsResponse.propConceptGroup.propConcept[0];

      res.json({
        success: true,
        data: drugDetails,
        message: 'Drug details retrieved successfully'
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug details service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error getting drug details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get drug interactions by RXCUI
router.get('/:rxcui/interactions', authenticateToken, async (req, res) => {
  try {
    const { rxcui } = req.params;
    
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      return res.status(400).json({
        success: false,
        error: 'Valid RXCUI is required'
      });
    }

    try {
      const interactionsResponse = await makeRxNormRequest(
        `/interaction/interaction.json?rxcui=${rxcui}`
      ) as any;

      const interactions = interactionsResponse.interactionTypeGroup || [];

      res.json({
        success: true,
        data: interactions,
        message: `Found ${interactions.length} interaction(s)`
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Drug interactions service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error getting drug interactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get spelling suggestions for drug names
router.get('/suggestions/:term', authenticateToken, async (req, res) => {
  try {
    const { term } = req.params;
    
    if (!term || term.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters long'
      });
    }

    try {
      const suggestionsResponse = await makeRxNormRequest(
        `/spellingsuggestions.json?name=${encodeURIComponent(term.trim())}`
      ) as any;

      const suggestions = suggestionsResponse.suggestionGroup?.suggestionList?.suggestion || [];

      res.json({
        success: true,
        data: suggestions,
        message: `Found ${suggestions.length} suggestion(s)`
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Spelling suggestions service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error getting spelling suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get related drugs (brand names, generics, etc.) by RXCUI
router.get('/:rxcui/related', authenticateToken, async (req, res) => {
  try {
    const { rxcui } = req.params;
    
    if (!rxcui || !/^\d+$/.test(rxcui)) {
      return res.status(400).json({
        success: false,
        error: 'Valid RXCUI is required'
      });
    }

    try {
      const relatedResponse = await makeRxNormRequest(
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

      res.json({
        success: true,
        data: concepts,
        message: `Found ${concepts.length} related drug(s)`
      });

    } catch (apiError) {
      console.error('RxNorm API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Related drugs service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Error getting related drugs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;