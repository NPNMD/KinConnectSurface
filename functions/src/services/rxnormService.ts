// RxNorm API helper function
export async function makeRxNormRequest(endpoint: string) {
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('RxNorm API request failed:', error);
    throw error;
  }
}

