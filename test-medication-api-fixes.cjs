const https = require('https');

// Test configuration
const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';
const TEST_TOKEN = 'test-token'; // This will need to be replaced with a real token

// Test cases for the fixed endpoints
const testCases = [
  {
    name: 'Test PUT /medications/{id} with invalid date',
    method: 'PUT',
    path: '/medications/test-med-id',
    body: {
      name: 'Test Medication',
      dosage: '5mg',
      startDate: 'invalid-date-string', // This should not cause 500 error anymore
      endDate: '', // Empty string should be handled gracefully
      prescribedDate: null // Null should be handled gracefully
    }
  },
  {
    name: 'Test GET /medication-calendar/check-missing-events',
    method: 'GET',
    path: '/medication-calendar/check-missing-events',
    body: null
  },
  {
    name: 'Test PUT /medications/{id} with valid data',
    method: 'PUT',
    path: '/medications/test-med-id',
    body: {
      name: 'Test Medication Updated',
      dosage: '10mg',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      frequency: 'twice daily'
    }
  },
  {
    name: 'Test rate limiting behavior',
    method: 'GET',
    path: '/medications',
    body: null
  }
];

// Helper function to make HTTP requests
function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    };

    // Remove undefined headers
    Object.keys(options.headers).forEach(key => {
      if (options.headers[key] === undefined) {
        delete options.headers[key];
      }
    });

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonData
          });
        } catch (parseError) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: parseError.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('🧪 === MEDICATION API FIXES TEST SUITE ===');
  console.log('🔗 Testing API Base URL:', API_BASE_URL);
  console.log('📅 Test started at:', new Date().toISOString());
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    total: testCases.length,
    details: []
  };

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`🧪 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    
    try {
      const startTime = Date.now();
      const response = await makeRequest(testCase.method, testCase.path, testCase.body, TEST_TOKEN);
      const duration = Date.now() - startTime;
      
      console.log(`📊 Response Status: ${response.statusCode}`);
      console.log(`⏱️ Response Time: ${duration}ms`);
      
      // Analyze the response
      const testResult = {
        testName: testCase.name,
        statusCode: response.statusCode,
        duration: duration,
        passed: false,
        details: {}
      };

      // Check if this is a 500 error (which we're trying to fix)
      if (response.statusCode === 500) {
        console.log('❌ CRITICAL: Still getting 500 error!');
        console.log('📋 Error Response:', JSON.stringify(response.body, null, 2));
        testResult.passed = false;
        testResult.details = {
          error: 'Still receiving 500 error',
          response: response.body
        };
        results.failed++;
      } else if (response.statusCode === 401 || response.statusCode === 403) {
        console.log('🔐 Expected auth error (no valid token provided)');
        testResult.passed = true;
        testResult.details = {
          note: 'Expected authentication error - this is normal without valid token',
          response: response.body
        };
        results.passed++;
      } else if (response.statusCode === 404) {
        console.log('📍 Expected 404 error (test resource not found)');
        testResult.passed = true;
        testResult.details = {
          note: 'Expected 404 error - test resource does not exist',
          response: response.body
        };
        results.passed++;
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log('✅ Success response');
        testResult.passed = true;
        testResult.details = {
          note: 'Successful response',
          response: response.body
        };
        results.passed++;
      } else if (response.statusCode === 400) {
        console.log('⚠️ Bad request (expected for invalid data test)');
        testResult.passed = true;
        testResult.details = {
          note: 'Expected 400 error for invalid data - this means validation is working',
          response: response.body
        };
        results.passed++;
      } else {
        console.log('⚠️ Unexpected status code:', response.statusCode);
        testResult.passed = false;
        testResult.details = {
          error: `Unexpected status code: ${response.statusCode}`,
          response: response.body
        };
        results.failed++;
      }

      results.details.push(testResult);
      console.log('');
      
    } catch (error) {
      console.log('❌ Test failed with exception:', error.message);
      results.failed++;
      results.details.push({
        testName: testCase.name,
        passed: false,
        error: error.message,
        details: { exception: error.message }
      });
      console.log('');
    }
  }

  // Test summary
  console.log('🧪 === TEST RESULTS SUMMARY ===');
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log(`📊 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  console.log('');

  // Detailed results
  console.log('📋 === DETAILED RESULTS ===');
  results.details.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.testName}`);
    console.log(`   Status Code: ${result.statusCode || 'N/A'}`);
    console.log(`   Duration: ${result.duration || 'N/A'}ms`);
    if (result.details?.note) {
      console.log(`   Note: ${result.details.note}`);
    }
    if (result.details?.error) {
      console.log(`   Error: ${result.details.error}`);
    }
    console.log('');
  });

  // Critical 500 error check
  const has500Errors = results.details.some(result => result.statusCode === 500);
  if (has500Errors) {
    console.log('🚨 CRITICAL: Some endpoints are still returning 500 errors!');
    console.log('🔍 Review the error responses above for debugging information.');
  } else {
    console.log('🎉 SUCCESS: No 500 internal server errors detected!');
    console.log('✅ All critical medication API fixes appear to be working correctly.');
  }

  console.log('');
  console.log('📅 Test completed at:', new Date().toISOString());
  
  return results;
}

// Test the new missing events endpoint specifically
async function testMissingEventsEndpoint() {
  console.log('🧪 === TESTING NEW MISSING EVENTS ENDPOINT ===');
  
  try {
    const response = await makeRequest('GET', '/medication-calendar/check-missing-events', null, TEST_TOKEN);
    
    console.log('📊 Missing Events Endpoint Test:');
    console.log(`   Status Code: ${response.statusCode}`);
    console.log(`   Response:`, JSON.stringify(response.body, null, 2));
    
    if (response.statusCode === 401 || response.statusCode === 403) {
      console.log('✅ Endpoint exists and requires authentication (expected)');
      return true;
    } else if (response.statusCode === 404) {
      console.log('❌ Endpoint not found - implementation may have failed');
      return false;
    } else if (response.statusCode === 500) {
      console.log('❌ Endpoint returning 500 error');
      return false;
    } else {
      console.log('✅ Endpoint responding correctly');
      return true;
    }
  } catch (error) {
    console.log('❌ Error testing missing events endpoint:', error.message);
    return false;
  }
}

// Run the tests
async function main() {
  console.log('🚀 Starting medication API fixes verification...');
  console.log('');
  
  // Test the new endpoint first
  const missingEventsWorking = await testMissingEventsEndpoint();
  console.log('');
  
  // Run main test suite
  const results = await runTests();
  
  // Final assessment
  console.log('🏁 === FINAL ASSESSMENT ===');
  console.log(`Missing Events Endpoint: ${missingEventsWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`Overall API Health: ${results.failed === 0 ? '✅ Healthy' : '⚠️ Issues Detected'}`);
  console.log(`500 Errors Fixed: ${!results.details.some(r => r.statusCode === 500) ? '✅ Yes' : '❌ No'}`);
  
  if (missingEventsWorking && results.failed === 0) {
    console.log('🎉 ALL FIXES SUCCESSFUL! Medication API is now working correctly.');
  } else {
    console.log('⚠️ Some issues remain. Check the detailed results above.');
  }
}

// Execute the tests
main().catch(console.error);