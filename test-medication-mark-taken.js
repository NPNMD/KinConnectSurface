const fetch = require('node-fetch');
const fs = require('fs');

// Firebase configuration
const serviceAccount = JSON.parse(fs.readFileSync('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json', 'utf8'));

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testMarkMedicationTaken() {
  try {
    console.log('🔍 Testing medication mark taken endpoint...');

    // First, let's get an auth token using the service account
    // For now, we'll use a simple approach - get a token from the client
    console.log('📝 Please provide an auth token from your browser console:');
    console.log('   1. Open your app in the browser');
    console.log('   2. Open browser dev tools (F12)');
    console.log('   3. Go to Console tab');
    console.log('   4. Run: firebase.auth().currentUser.getIdToken()');
    console.log('   5. Copy the token and paste it below:');

    // For now, let's try a simple test without auth to see the error
    const testEventId = 'Kik7MbDHP5tutkbdQKgW'; // From the error log

    const response = await fetch(`${API_BASE}/medication-calendar/events/${testEventId}/taken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth header for now
      },
      body: JSON.stringify({
        takenAt: new Date().toISOString(),
        notes: 'Test note'
      })
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📊 Response body:', responseText);

    if (response.status === 500) {
      console.log('❌ Got 500 error as expected. Let\'s try with auth token...');

      // You can manually test with auth token here
      console.log('🔧 To test with auth, run this in your browser console:');
      console.log(`
firebase.auth().currentUser.getIdToken().then(token => {
  fetch('${API_BASE}/medication-calendar/events/${testEventId}/taken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      takenAt: new Date().toISOString(),
      notes: 'Test from browser'
    })
  }).then(r => r.text()).then(console.log);
});
      `);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMarkMedicationTaken();
