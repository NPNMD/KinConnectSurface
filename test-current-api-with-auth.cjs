const https = require('https');

// Test the current deployed API with a valid event ID from the cleanup results
async function testCurrentAPIWithValidEvent() {
  try {
    console.log('🧪 Testing current deployed API with valid event ID...');
    
    // Use one of the valid event IDs from the cleanup results
    const validEventId = 'MmX2DlaBUmcG4Hg7QlZY'; // This is the one that was kept after cleanup
    
    // Test data for marking medication as taken - clean payload
    const testData = {
      takenAt: new Date().toISOString()
      // No notes field to avoid undefined issues
    };
    
    console.log('📝 Test data (clean):', testData);
    console.log('🎯 Testing with valid event ID:', validEventId);
    
    const apiUrl = `https://us-central1-claritystream-uldp9.cloudfunctions.net/api/medication-calendar/events/${validEventId}/taken`;
    
    console.log('🔗 Testing API URL:', apiUrl);
    
    // Create the request payload
    const payload = JSON.stringify(testData);
    
    console.log('📦 Request payload:', payload);
    
    // Test without authentication to see the response structure
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    console.log('🔧 Request options:', options);
    
    const req = https.request(apiUrl, options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 Response body:', data);
        
        if (res.statusCode === 401) {
          console.log('✅ Expected 401 (authentication required) - API structure is working');
          console.log('🎉 This means the endpoint exists and can handle the request format');
          console.log('💡 The 500 error you\'re seeing is likely due to the old deployed version');
          console.log('🚀 Need to deploy the backend fixes to resolve the issue');
        } else if (res.statusCode === 500) {
          console.log('❌ Still getting 500 error - old version is deployed');
          try {
            const errorData = JSON.parse(data);
            console.log('❌ Error details:', errorData);
          } catch (e) {
            console.log('❌ Raw error response:', data);
          }
        } else if (res.statusCode === 404) {
          console.log('❌ 404 - Event not found or endpoint doesn\'t exist');
        } else {
          console.log('📡 Unexpected status code:', res.statusCode);
          console.log('📡 Response:', data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
    });
    
    req.write(payload);
    req.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test the health endpoint to verify deployment status
async function testHealthEndpoint() {
  try {
    console.log('\n🏥 Testing health endpoint to check deployment status...');
    
    const healthUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/health';
    
    const req = https.request(healthUrl, { method: 'GET' }, (res) => {
      console.log('🏥 Health endpoint status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('🏥 Health response:', data);
        
        if (res.statusCode === 200) {
          try {
            const healthData = JSON.parse(data);
            console.log('✅ API is healthy:', healthData);
          } catch (e) {
            console.log('✅ API responded but couldn\'t parse JSON');
          }
        } else {
          console.log('❌ Health check failed');
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Health check error:', error);
    });
    
    req.end();
    
  } catch (error) {
    console.error('❌ Health test failed:', error);
  }
}

// Run the tests
console.log('🚀 Starting API tests with valid event ID...');
testCurrentAPIWithValidEvent();

setTimeout(() => {
  testHealthEndpoint();
}, 3000);

// Keep the process alive for a moment to see the response
setTimeout(() => {
  console.log('🏁 Tests completed');
  process.exit(0);
}, 8000);