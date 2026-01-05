// RxNorm API base URL
const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

// Helper function to make requests to RxNorm API
export async function makeRxNormRequest(endpoint: string) {
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

