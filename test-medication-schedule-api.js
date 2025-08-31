const fetch = require('node-fetch');

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test token - you'll need to replace this with a valid Firebase ID token
const TEST_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjkyZTg4M2NjNDY...'; // Replace with actual token

async function testMedicationScheduleEndpoints() {
  console.log('🧪 Testing Medication Schedule API Endpoints...\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_TOKEN}`
  };

  // Test 1: Get medication schedules
  console.log('1️⃣ Testing GET /medication-calendar/schedules');
  try {
    const response = await fetch(`${API_BASE}/medication-calendar/schedules`, {
      method: 'GET',
      headers
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  // Test 2: Get medication schedules by medication ID
  const testMedicationId = 'SkM1OZnPenX8wkSD8FzR'; // From the error logs
  console.log(`2️⃣ Testing GET /medication-calendar/schedules/medication/${testMedicationId}`);
  try {
    const response = await fetch(`${API_BASE}/medication-calendar/schedules/medication/${testMedicationId}`, {
      method: 'GET',
      headers
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  // Test 3: Get medication calendar events
  console.log('3️⃣ Testing GET /medication-calendar/events');
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      medicationId: testMedicationId
    });
    
    const response = await fetch(`${API_BASE}/medication-calendar/events?${params}`, {
      method: 'GET',
      headers
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  // Test 4: Create a medication schedule
  console.log('4️⃣ Testing POST /medication-calendar/schedules');
  try {
    const scheduleData = {
      medicationId: testMedicationId,
      frequency: 'twice_daily',
      // Don't provide times - let backend generate defaults
      startDate: new Date().toISOString(),
      isIndefinite: true,
      generateCalendarEvents: true
      // Don't provide dosageAmount - let backend auto-fill from medication
    };
    
    const response = await fetch(`${API_BASE}/medication-calendar/schedules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(scheduleData)
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('\n');

  console.log('✅ API endpoint testing completed!');
}

// Run the tests
testMedicationScheduleEndpoints().catch(console.error);