/**
 * Simple test to check family access API response
 */

const fetch = require('node-fetch');

async function testFamilyAccess() {
  console.log('🧪 Testing Family Access API');
  console.log('=' .repeat(40));

  try {
    // Test the family access endpoint directly
    const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/family-access', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token', // This will fail auth but we can see the response
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.text();
    console.log('Response body:', data);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFamilyAccess();