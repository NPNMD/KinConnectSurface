// Test script to validate API endpoint fixes
const https = require('https');

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test endpoints
const endpoints = [
  '/health',
  '/family-access',
  '/medical-events/test-user-id'
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${API_BASE}${endpoint}`;
    console.log(`\n🔧 Testing: ${url}`);
    
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📊 Headers:`, res.headers);
        
        if (res.statusCode === 404) {
          console.log(`❌ 404 - Route not found for ${endpoint}`);
        } else if (res.statusCode === 401) {
          console.log(`🔐 401 - Authentication required for ${endpoint} (expected)`);
        } else if (res.statusCode === 200) {
          console.log(`✅ 200 - Success for ${endpoint}`);
          try {
            const parsed = JSON.parse(data);
            console.log(`📄 Response:`, parsed);
          } catch (e) {
            console.log(`📄 Raw response:`, data.substring(0, 200));
          }
        } else {
          console.log(`⚠️ ${res.statusCode} - Unexpected status for ${endpoint}`);
        }
        
        resolve({
          endpoint,
          status: res.statusCode,
          success: res.statusCode !== 404
        });
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ Network error for ${endpoint}:`, error.message);
      resolve({
        endpoint,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      console.log(`⏰ Timeout for ${endpoint}`);
      req.destroy();
      resolve({
        endpoint,
        status: 'TIMEOUT',
        success: false
      });
    });
  });
}

async function runTests() {
  console.log('🚀 Testing API endpoints after fixes...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    const status = result.success ? '✅ WORKING' : '❌ FAILED';
    console.log(`${status} ${result.endpoint} (${result.status})`);
  });
  
  const workingCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Result: ${workingCount}/${totalCount} endpoints are accessible`);
  
  if (workingCount === totalCount) {
    console.log('🎉 All endpoints are working! The 404 errors should be resolved.');
  } else {
    console.log('⚠️ Some endpoints still have issues. Check Firebase Functions deployment.');
  }
}

runTests().catch(console.error);