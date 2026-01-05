interface DrugImage {
  imageUrl: string;
  ndc?: string;
  name: string;
  labeler?: string;
}

export class RxImageService {
  private baseUrl = 'https://rximage.nlm.nih.gov/api/rximage/1';
  
  /**
   * Get drug images by RxCUI
   */
  async getImagesByRxcui(rxcui: string): Promise<DrugImage[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?rxcui=${rxcui}&rLimit=5`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      return data.nlmRxImages || [];
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
  
  /**
   * Get drug images by NDC (National Drug Code)
   */
  async getImagesByNdc(ndc: string): Promise<DrugImage[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?ndc=${ndc}`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      return data.nlmRxImages || [];
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
  
  /**
   * Get drug images by name (text search)
   */
  async getImagesByName(name: string): Promise<DrugImage[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/rximage?name=${encodeURIComponent(name)}&rLimit=5`
      );
      
      if (!response.ok) {
        console.error(`RxImage API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      return data.nlmRxImages || [];
    } catch (error) {
      console.error('Error fetching drug images:', error);
      return [];
    }
  }
}

export const rxImageService = new RxImageService();

