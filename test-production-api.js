// Test the production API endpoints for family invitations
// Run with: node test-production-api.js

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const LOCAL_API_URL = 'http://localhost:3001';
const PRODUCTION_API_URL = process.env.VITE_API_URL || 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/api';
const TEST_EMAIL = 'mike.nguyen@twfg.com';

async function testProductionAPI() {
  console.log('🧪 Testing Production Family Invitation API...\n');
  
  try {
    // Test local server first (since it's running)
    console.log('1. Testing local server API...');
    console.log(`Local API URL: ${LOCAL_API_URL}`);
    
    // Test health endpoint
    try {
      const healthResponse = await fetch(`${LOCAL_API_URL}/api/health`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Local server health check:', healthData);
      } else {
        console.log('⚠️ Local server health check failed:', healthResponse.status);
      }
    } catch (error) {
      console.log('❌ Local server not accessible:', error.message);
    }
    
    // Test invitation endpoint without auth (to see the error response)
    console.log('\n2. Testing invitation endpoint structure...');
    
    const testPayload = {
      email: TEST_EMAIL,
      patientName: 'Test Patient (Production Test)'
    };
    
    try {
      const response = await fetch(`${LOCAL_API_URL}/api/invitations/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log(`Response Status: ${response.status}`);
      const responseData = await response.json();
      console.log('Response Data:', responseData);
      
      if (response.status === 401) {
        console.log('✅ Authentication required (expected behavior)');
      } else if (response.status === 404) {
        console.log('❌ Endpoint not found - check server routing');
      }
      
    } catch (error) {
      console.log('❌ API request failed:', error.message);
    }
    
    // Test production server
    console.log('\n3. Testing production server...');
    console.log(`Production API URL: ${PRODUCTION_API_URL}`);
    
    try {
      const prodHealthResponse = await fetch(`${PRODUCTION_API_URL}/health`);
      console.log(`Production health status: ${prodHealthResponse.status}`);
      
      if (prodHealthResponse.ok) {
        const prodHealthData = await prodHealthResponse.json();
        console.log('✅ Production server health:', prodHealthData);
      }
    } catch (error) {
      console.log('❌ Production server not accessible:', error.message);
    }
    
    // Test production invitation endpoint
    try {
      const prodResponse = await fetch(`${PRODUCTION_API_URL}/invitations/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log(`Production invitation status: ${prodResponse.status}`);
      const prodResponseData = await prodResponse.json();
      console.log('Production response:', prodResponseData);
      
    } catch (error) {
      console.log('❌ Production invitation request failed:', error.message);
    }
    
    console.log('\n📋 Test Summary:');
    console.log('   - Local server is running on Terminal 2');
    console.log('   - Testing API endpoints without authentication');
    console.log('   - Checking endpoint availability and routing');
    console.log('   - Verifying error handling');
    
    console.log('\n🔧 Next Steps:');
    console.log('   1. Verify server routing includes /api/invitations/send');
    console.log('   2. Test with proper Firebase authentication');
    console.log('   3. Check SendGrid configuration in production');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test direct SendGrid functionality using environment variables
async function testSendGridConfig() {
  console.log('\n📧 Testing SendGrid Configuration...');
  
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME;
  
  console.log(`API Key: ${apiKey ? '✅ Configured (' + apiKey.substring(0, 10) + '...)' : '❌ Missing'}`);
  console.log(`From Email: ${fromEmail || '❌ Missing'}`);
  console.log(`From Name: ${fromName || '❌ Missing'}`);
  
  if (apiKey && fromEmail) {
    console.log('✅ SendGrid appears to be properly configured');
    
    // Test SendGrid API directly
    try {
      const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: TEST_EMAIL }],
            subject: 'KinConnect Production Test Email'
          }],
          from: { email: fromEmail, name: fromName },
          content: [{
            type: 'text/html',
            value: `
              <h2>KinConnect Production Email Test</h2>
              <p>This is a test email sent directly to SendGrid API to verify production email functionality.</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p>If you received this email, the SendGrid integration is working correctly!</p>
            `
          }]
        })
      });
      
      console.log(`SendGrid API Response: ${sgResponse.status}`);
      
      if (sgResponse.status === 202) {
        console.log('✅ Email sent successfully via SendGrid API!');
        console.log(`📧 Check ${TEST_EMAIL} for the test email`);
      } else {
        const errorData = await sgResponse.text();
        console.log('❌ SendGrid API error:', errorData);
      }
      
    } catch (error) {
      console.log('❌ SendGrid API test failed:', error.message);
    }
  } else {
    console.log('❌ SendGrid not properly configured');
  }
}

// Run tests
console.log('Starting production API tests...\n');
testProductionAPI()
  .then(() => testSendGridConfig())
  .then(() => {
    console.log('\n✅ All tests completed!');
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
  });