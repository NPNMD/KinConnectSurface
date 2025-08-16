// Test script for the family access API endpoint with authentication check
// Run with: node test-family-access-with-auth.js

import fetch from 'node-fetch';

const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testFamilyAccessWithAuth() {
  console.log('🧪 Testing Family Access API Endpoint with Auth Check...\n');
  
  try {
    // Test the health endpoint first
    console.log('1. Testing API server availability...');
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ API server is running');
      console.log('Health response:', healthData);
    } else {
      console.log('❌ API server not responding correctly');
      return;
    }
    
    // Test the family access endpoint (without auth - should return 401)
    console.log('\n2. Testing family access endpoint with no auth...');
    const familyAccessResponse = await fetch(`${API_BASE_URL}/api/invitations/family-access`);
    
    console.log(`Response Status: ${familyAccessResponse.status}`);
    
    if (familyAccessResponse.status === 401) {
      console.log('✅ Endpoint exists and requires authentication (expected behavior)');
      const errorResponse = await familyAccessResponse.json();
      console.log('Response:', errorResponse);
    } else if (familyAccessResponse.status === 404) {
      console.log('❌ Endpoint not found - route may not be deployed yet');
      const errorResponse = await familyAccessResponse.text();
      console.log('Response:', errorResponse);
    } else {
      console.log('⚠️ Unexpected response status');
      const response = await familyAccessResponse.text();
      console.log('Response:', response);
    }
    
    // Test other invitation endpoints
    console.log('\n3. Testing other invitation endpoints...');
    
    // Test send invitation endpoint
    const sendResponse = await fetch(`${API_BASE_URL}/api/invitations/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', patientName: 'Test' })
    });
    console.log(`Send invitation endpoint status: ${sendResponse.status}`);
    
    // Test get invitation by token
    const getResponse = await fetch(`${API_BASE_URL}/api/invitations/test-token`);
    console.log(`Get invitation endpoint status: ${getResponse.status}`);
    
    console.log('\n✅ API endpoint structure tests completed!');
    console.log('\n📋 Summary:');
    console.log('   - API server is running');
    console.log('   - Testing endpoint authentication requirements');
    console.log('   - Checking if routes are properly deployed');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testFamilyAccessWithAuth();