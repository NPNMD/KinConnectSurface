// Direct test of the family access endpoint
// Run with: node test-endpoint-direct.js

import fetch from 'node-fetch';

const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testEndpointDirect() {
  console.log('🧪 Testing Family Access Endpoint Directly...\n');
  
  try {
    // Test with a fake auth token to see if we get 401 vs 404
    console.log('1. Testing family access endpoint with fake auth...');
    const familyAccessResponse = await fetch(`${API_BASE_URL}/api/invitations/family-access`, {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      }
    });
    
    console.log(`Response Status: ${familyAccessResponse.status}`);
    const responseText = await familyAccessResponse.text();
    console.log('Response:', responseText);
    
    if (familyAccessResponse.status === 401 || familyAccessResponse.status === 403) {
      console.log('✅ Endpoint exists and requires authentication!');
    } else if (familyAccessResponse.status === 404) {
      console.log('❌ Endpoint still not found - route ordering issue persists');
    } else {
      console.log('⚠️ Unexpected response status');
    }
    
    // Test the parameterized route to confirm it's working
    console.log('\n2. Testing parameterized route...');
    const paramResponse = await fetch(`${API_BASE_URL}/api/invitations/test-token-123`);
    console.log(`Parameterized route status: ${paramResponse.status}`);
    const paramText = await paramResponse.text();
    console.log('Parameterized response:', paramText);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testEndpointDirect();