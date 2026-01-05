import { config } from '../config';
import { cacheService } from './cacheService';

interface DailyMedDrug {
  setid: string;
  title: string;
  published_date: string;
  splDocType: string;
}

interface DailyMedDetails {
  setid: string;
  title: string;
  indications?: string;
  dosage?: string;
  warnings?: string;
  contraindications?: string;
  adverseReactions?: string;
  drugInteractions?: string;
}

export class DailyMedService {
  private baseUrl = config.DAILYMED_BASE_URL;
  private cacheTTL = config.CACHE_TTL_DRUG_DATA; // 24 hours for clinical info
  
  /**
   * Search for drug products
   */
  async searchDrug(drugName: string): Promise<DailyMedDrug[]> {
    if (!config.ENABLE_CLINICAL_INFO) return [];

    const cacheKey = `search:${drugName.toLowerCase()}`;

    // Check cache first
    const cached = await cacheService.get<DailyMedDrug[]>('dailymed', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/spls.json?drug=${encodeURIComponent(drugName)}`
      );
      
      if (!response.ok) {
        console.error(`DailyMed API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      const results = data.data || [];

      // Cache the results
      if (results.length > 0) {
        await cacheService.set('dailymed', cacheKey, results, this.cacheTTL);
      }

      return results;
    } catch (error) {
      console.error('Error searching DailyMed:', error);
      return [];
    }
  }
  
  /**
   * Get detailed drug information
   */
  async getDrugDetails(setid: string): Promise<DailyMedDetails | null> {
    if (!config.ENABLE_CLINICAL_INFO) return null;

    const cacheKey = `details:${setid}`;

    // Check cache first
    const cached = await cacheService.get<DailyMedDetails>('dailymed', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/spls/${setid}.json`);
      
      if (!response.ok) {
        console.error(`DailyMed API error: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const spl = data.data;
      
      // Extract relevant sections from the SPL (Structured Product Label)
      const details: DailyMedDetails = {
        setid: spl.setid,
        title: spl.title,
        indications: this.extractSection(spl, 'indications_and_usage'),
        dosage: this.extractSection(spl, 'dosage_and_administration'),
        warnings: this.extractSection(spl, 'warnings_and_cautions'),
        contraindications: this.extractSection(spl, 'contraindications'),
        adverseReactions: this.extractSection(spl, 'adverse_reactions'),
        drugInteractions: this.extractSection(spl, 'drug_interactions')
      };

      // Cache the details
      await cacheService.set('dailymed', cacheKey, details, this.cacheTTL);

      return details;
    } catch (error) {
      console.error('Error fetching DailyMed details:', error);
      return null;
    }
  }
  
  /**
   * Extract and clean section text from SPL
   */
  private extractSection(spl: any, sectionName: string): string | undefined {
    try {
      const section = spl[sectionName];
      if (!section) return undefined;
      
      // SPL sections can be complex nested structures
      // Extract text and clean up HTML
      let text = typeof section === 'string' ? section : JSON.stringify(section);
      
      // Remove HTML tags (basic cleaning)
      text = text.replace(/<[^>]+>/g, '');
      
      // Decode HTML entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      return text.length > 0 ? text : undefined;
    } catch (error) {
      console.error(`Error extracting section ${sectionName}:`, error);
      return undefined;
    }
  }
}

export const dailyMedService = new DailyMedService();
