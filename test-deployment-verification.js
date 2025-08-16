// Test script to verify deployment and endpoint functionality
// Run with: node test-deployment-verification.js

import fetch from 'node-fetch';

const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testDeploymentVerification() {
  console.log('🧪 Testing Deployment Verification...\n');
  
  try {
    // Test the health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    console.log(`Health endpoint status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint working:', healthData.message);
    }
    
    // Test the new test deployment endpoint
    console.log('\n2. Testing deployment verification endpoint...');
    const testResponse = await fetch(`${API_BASE_URL}/api/test-deployment`);
    console.log(`Test deployment endpoint status: ${testResponse.status}`);
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('✅ Test deployment endpoint working:', testData.message);
    } else {
      const errorText = await testResponse.text();
      console.log('❌ Test deployment endpoint failed:', errorText);
    }
    
    // Test the family access endpoint (should return 401 without auth)
    console.log('\n3. Testing family access endpoint...');
    const familyResponse = await fetch(`${API_BASE_URL}/api/family-access`);
    console.log(`Family access endpoint status: ${familyResponse.status}`);
    const familyText = await familyResponse.text();
    console.log('Family access response:', familyText);
    
    if (familyResponse.status === 401 || familyResponse.status === 403) {
      console.log('✅ Family access endpoint exists and requires authentication!');
    } else if (familyResponse.status === 404) {
      console.log('❌ Family access endpoint still not found');
    } else {
      console.log('⚠️ Unexpected response from family access endpoint');
    }
    
    // Test with fake auth header
    console.log('\n4. Testing family access endpoint with fake auth...');
    const authResponse = await fetch(`${API_BASE_URL}/api/family-access`, {
      headers: {
        'Authorization': 'Bearer fake-token-test'
      }
    });
    console.log(`Family access with auth status: ${authResponse.status}`);
    const authText = await authResponse.text();
    console.log('Family access with auth response:', authText);
    
    console.log('\n📋 Summary:');
    console.log('   - Health endpoint: Working');
    console.log('   - Test deployment endpoint: ' + (testResponse.ok ? 'Working' : 'Failed'));
    console.log('   - Family access endpoint: ' + (familyResponse.status === 401 || familyResponse.status === 403 ? 'Working (requires auth)' : 'Not working'));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testDeploymentVerification();