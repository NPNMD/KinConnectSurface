// Test the new family access endpoint path
// Run with: node test-new-endpoint.js

import fetch from 'node-fetch';

const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testNewEndpoint() {
  console.log('🧪 Testing New Family Access Endpoint Path...\n');
  
  try {
    // Test the new endpoint path with fake auth
    console.log('1. Testing new family access endpoint...');
    const familyAccessResponse = await fetch(`${API_BASE_URL}/api/family-access`, {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      }
    });
    
    console.log(`Response Status: ${familyAccessResponse.status}`);
    const responseText = await familyAccessResponse.text();
    console.log('Response:', responseText);
    
    if (familyAccessResponse.status === 401 || familyAccessResponse.status === 403) {
      console.log('✅ NEW ENDPOINT WORKS! It exists and requires authentication!');
    } else if (familyAccessResponse.status === 404) {
      console.log('❌ New endpoint still not found');
    } else {
      console.log('⚠️ Unexpected response status');
    }
    
    // Test the old problematic path to confirm it's gone
    console.log('\n2. Testing old problematic path...');
    const oldResponse = await fetch(`${API_BASE_URL}/api/invitations/family-access`);
    console.log(`Old path status: ${oldResponse.status}`);
    const oldText = await oldResponse.text();
    console.log('Old path response:', oldText);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testNewEndpoint();