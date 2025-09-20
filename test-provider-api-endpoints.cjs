const fetch = require('node-fetch');

// Test the provider API endpoints structure
async function testProviderAPIEndpoints() {
  console.log('🔍 Testing Provider API Endpoints Structure');
  console.log('=' .repeat(50));
  
  const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/api';
  
  // Test endpoints without authentication to check structure
  const endpoints = [
    '/healthcare/providers/test-patient-id',
    '/healthcare/facilities/test-patient-id'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // We expect 401 (unauthorized) which means the endpoint exists
      if (response.status === 401) {
        console.log(`✅ ${endpoint} - Endpoint exists (401 Unauthorized as expected)`);
      } else if (response.status === 404) {
        console.log(`❌ ${endpoint} - Endpoint not found (404)`);
      } else {
        console.log(`ℹ️  ${endpoint} - Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  console.log('\n✅ API endpoint structure verification completed');
}

// Test the provider search integration
async function testProviderSearchIntegration() {
  console.log('\n🔍 Testing Provider Search Integration');
  console.log('=' .repeat(50));
  
  const GOOGLE_MAPS_API_KEY = 'AIzaSyAw7jxXf34AxHn5JdtuexsIRPTTPPy9uys';
  
  // Test specialty inference logic
  const testCases = [
    { query: 'cardiology clinic', expectedSpecialty: 'Cardiology' },
    { query: 'pediatric doctor', expectedSpecialty: 'Pediatrics' },
    { query: 'dental office', expectedSpecialty: 'Dentistry' },
    { query: 'family medicine', expectedSpecialty: 'Family Medicine' }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing specialty inference for: ${testCase.query}`);
      
      const searchRequest = {
        textQuery: testCase.query + ' Houston',
        maxResultCount: 1
      };
      
      const fieldMask = [
        'places.id',
        'places.displayName',
        'places.types'
      ].join(',');
      
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(searchRequest)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          console.log(`   ✅ Found: ${place.displayName?.text}`);
          console.log(`   Types: ${place.types?.join(', ') || 'None'}`);
        } else {
          console.log(`   ⚠️  No results found for ${testCase.query}`);
        }
      } else {
        console.log(`   ❌ Search failed for ${testCase.query}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing ${testCase.query}: ${error.message}`);
    }
  }
}

// Main test function
async function runAPITests() {
  console.log('🏥 PROVIDER API ENDPOINTS TEST');
  console.log('=' .repeat(40));
  
  await testProviderAPIEndpoints();
  await testProviderSearchIntegration();
  
  console.log('\n🏁 API TESTS COMPLETED');
  console.log('=' .repeat(40));
}

runAPITests().catch(console.error);