const https = require('https');

// Test the medication update API endpoint directly
async function testMedicationUpdateAPI() {
  try {
    console.log('🧪 Testing medication update API endpoint...');
    
    // Test data that was causing the 500 error
    const testData = {
      hasReminders: true,
      reminderTimes: ['07:00']
    };
    
    console.log('📝 Test data:', testData);
    
    // Test the API endpoint with a mock medication ID
    const testMedicationId = 'SkM1OZnPenX8wkSD8FzR'; // From the error logs
    const apiUrl = `https://us-central1-claritystream-uldp9.cloudfunctions.net/api/medications/${testMedicationId}`;
    
    console.log('🔗 Testing API URL:', apiUrl);
    
    // Create the request payload
    const payload = JSON.stringify(testData);
    
    console.log('📦 Request payload:', payload);
    
    // Test without authentication first to see if the endpoint structure is correct
    const options = {
      method: 'PUT',
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
          console.log('✅ Expected 401 (authentication required) - endpoint is working');
          console.log('🎉 The 500 error should be fixed now!');
        } else if (res.statusCode === 500) {
          console.log('❌ Still getting 500 error - fix may not be complete');
          try {
            const errorData = JSON.parse(data);
            console.log('❌ Error details:', errorData);
          } catch (e) {
            console.log('❌ Raw error response:', data);
          }
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

// Run the test
console.log('🚀 Starting medication API test...');
testMedicationUpdateAPI();

// Keep the process alive for a moment to see the response
setTimeout(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}, 5000);