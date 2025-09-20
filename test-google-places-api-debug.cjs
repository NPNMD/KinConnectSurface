const fetch = require('node-fetch');

// Test Google Places API configuration and request format
async function testGooglePlacesAPI() {
  console.log('🔍 Testing Google Places API configuration...');
  
  // This would normally come from environment variables
  const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || 'your_api_key_here';
  
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    console.error('❌ Google Maps API key not found or not set');
    return;
  }
  
  console.log('✅ API Key found:', API_KEY.substring(0, 10) + '...');
  
  // Test 1: Simple text search request
  console.log('\n🧪 Test 1: Simple text search...');
  
  const searchRequest = {
    textQuery: 'doctor clinic medical',
    maxResultCount: 5
  };
  
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
      },
      body: JSON.stringify(searchRequest)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (!response.ok) {
      console.error('❌ API request failed');
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('Raw error response:', responseText);
      }
    } else {
      console.log('✅ API request successful');
      const data = JSON.parse(responseText);
      console.log('Results:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
  
  // Test 2: Check if Places API (New) is enabled
  console.log('\n🧪 Test 2: Check API enablement...');
  
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/ChIJN1t_tDeuEmsRUsoyG83frY4?key=${API_KEY}`, {
      method: 'GET',
      headers: {
        'X-Goog-FieldMask': 'id,displayName'
      }
    });
    
    console.log('API enablement check status:', response.status);
    
    if (response.status === 403) {
      console.error('❌ Places API (New) is not enabled for this project');
      console.log('💡 Enable it at: https://console.cloud.google.com/apis/library/places-backend.googleapis.com');
    } else if (response.status === 400) {
      console.log('✅ Places API (New) is enabled (400 is expected for invalid place ID)');
    } else {
      console.log('✅ Places API (New) appears to be enabled');
    }
    
  } catch (error) {
    console.error('❌ API enablement check failed:', error.message);
  }
  
  // Test 3: Try legacy Places API format
  console.log('\n🧪 Test 3: Test legacy Places API...');
  
  try {
    const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=doctor+clinic&key=${API_KEY}`;
    const response = await fetch(legacyUrl);
    
    console.log('Legacy API status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Legacy Places API working');
      console.log('Sample result:', data.results?.[0]?.name || 'No results');
    } else {
      console.error('❌ Legacy Places API failed');
    }
    
  } catch (error) {
    console.error('❌ Legacy API test failed:', error.message);
  }
}

// Run the test
testGooglePlacesAPI().catch(console.error);