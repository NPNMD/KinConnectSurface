import https from 'https';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test endpoints
const endpoints = [
  '/health',
  '/medication-calendar/events',
  '/medication-calendar/adherence',
  '/family-access',
  '/medical-events/test-patient-id'
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${API_BASE}${endpoint}`;
    console.log(`Testing: ${url}`);
    
    const req = https.get(url, (res) => {
      console.log(`${endpoint}: ${res.statusCode} ${res.statusMessage}`);
      resolve({
        endpoint,
        status: res.statusCode,
        message: res.statusMessage
      });
    });
    
    req.on('error', (error) => {
      console.log(`${endpoint}: ERROR - ${error.message}`);
      resolve({
        endpoint,
        status: 'ERROR',
        message: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      console.log(`${endpoint}: TIMEOUT`);
      req.destroy();
      resolve({
        endpoint,
        status: 'TIMEOUT',
        message: 'Request timeout'
      });
    });
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');
  
  const results = [];
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    console.log(''); // Add spacing
  }
  
  console.log('\n=== SUMMARY ===');
  results.forEach(result => {
    const status = result.status === 401 ? 'OK (Auth Required)' : 
                   result.status === 200 ? 'OK' :
                   result.status === 404 ? 'NOT FOUND' :
                   result.status;
    console.log(`${result.endpoint}: ${status}`);
  });
}

runTests().catch(console.error);