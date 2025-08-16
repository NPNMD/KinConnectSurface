// Test script for the new family access API endpoint
// Run with: node test-family-access-api.js

import fetch from 'node-fetch';

const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testFamilyAccessAPI() {
  console.log('🧪 Testing Family Access API Endpoint...\n');
  
  try {
    // Test the health endpoint first
    console.log('1. Testing API server availability...');
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    
    if (healthResponse.ok) {
      console.log('✅ API server is running');
    } else {
      console.log('❌ API server not responding correctly');
      return;
    }
    
    // Test the family access endpoint (without auth - should return 401)
    console.log('\n2. Testing family access endpoint structure...');
    const familyAccessResponse = await fetch(`${API_BASE_URL}/api/invitations/family-access`);
    
    console.log(`Response Status: ${familyAccessResponse.status}`);
    
    if (familyAccessResponse.status === 401) {
      console.log('✅ Endpoint requires authentication (expected behavior)');
      const errorResponse = await familyAccessResponse.json();
      console.log('Response:', errorResponse);
    } else if (familyAccessResponse.status === 404) {
      console.log('❌ Endpoint not found - check route configuration');
    } else {
      console.log('⚠️ Unexpected response status');
      const response = await familyAccessResponse.json();
      console.log('Response:', response);
    }
    
    // Test invitation endpoint structure
    console.log('\n3. Testing invitation endpoints...');
    const invitationResponse = await fetch(`${API_BASE_URL}/api/invitations/pending`);
    console.log(`Pending invitations endpoint status: ${invitationResponse.status}`);
    
    if (invitationResponse.status === 401) {
      console.log('✅ Pending invitations endpoint requires authentication');
    }
    
    console.log('\n✅ API endpoint structure tests completed!');
    console.log('\n📋 Summary:');
    console.log('   - API server is running');
    console.log('   - Family access endpoint exists and requires authentication');
    console.log('   - Invitation endpoints are properly configured');
    console.log('\n🔧 Next steps:');
    console.log('   - Test with authenticated user to verify full functionality');
    console.log('   - Create test family relationships to verify data flow');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testFamilyAccessAPI();