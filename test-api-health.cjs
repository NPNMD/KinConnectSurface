const fetch = require('node-fetch');

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testApiHealth() {
  console.log('🧪 Testing API Health...\n');

  // Test 1: Health endpoint (no auth required)
  console.log('1️⃣ Testing GET /health');
  try {
    const response = await fetch(`${API_BASE}/health`);
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  // Test 2: Test deployment endpoint (no auth required)
  console.log('2️⃣ Testing GET /test-deployment');
  try {
    const response = await fetch(`${API_BASE}/test-deployment`);
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  // Test 3: Test medication calendar endpoints (should return 401 without auth)
  console.log('3️⃣ Testing GET /medication-calendar/schedules (should return 401)');
  try {
    const response = await fetch(`${API_BASE}/medication-calendar/schedules`);
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  console.log('✅ API health testing completed!');
  console.log('📝 If endpoints return 401, that means they exist and are properly protected.');
  console.log('📝 If endpoints return 404, that means they are missing.');
  console.log('📝 If endpoints return 500, that means there are server errors.');
}

// Run the tests
testApiHealth().catch(console.error);