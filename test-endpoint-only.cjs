const fetch = require('node-fetch');

async function testTranscriptionEndpoint() {
  try {
    console.log('🧪 Testing transcription endpoint...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    // Create test audio data (base64 encoded silence)
    const testAudioData = Buffer.alloc(1024, 0).toString('base64');
    
    const apiUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/audio/transcribe';
    
    console.log('🔧 Testing endpoint:', apiUrl);
    console.log('📊 Test audio size:', testAudioData.length, 'characters');
    
    // Test without authentication first to see the response structure
    console.log('\n1️⃣ Testing without authentication...');
    const unauthResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData: testAudioData,
        patientId: 'test-patient-id',
        audioQuality: 'test'
      })
    });
    
    console.log('📊 Unauth response status:', unauthResponse.status, unauthResponse.statusText);
    const unauthData = await unauthResponse.json();
    console.log('📊 Unauth response:', JSON.stringify(unauthData, null, 2));
    
    // Instructions for authenticated test
    console.log('\n2️⃣ To test with authentication:');
    console.log('1. Open your browser and go to the KinConnect app');
    console.log('2. Open browser console (F12)');
    console.log('3. Run: await firebase.auth().currentUser.getIdToken()');
    console.log('4. Copy the token and run this command:');
    console.log('');
    console.log('curl -X POST \\');
    console.log(`  "${apiUrl}" \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
    console.log('  -d \'{"audioData":"' + testAudioData.substring(0, 50) + '...","patientId":"test-patient","audioQuality":"test"}\'');
    
    console.log('\n3️⃣ Expected results:');
    console.log('✅ With valid token: Should return success with empty transcription (silence)');
    console.log('❌ With invalid/no token: Should return 401 Unauthorized');
    
    console.log('\n4️⃣ Google Cloud Logs:');
    console.log('Check logs at: https://console.cloud.google.com/logs/query?project=claritystream-uldp9');
    console.log('Filter: resource.type="cloud_function" AND jsonPayload.message=~"Speech-to-Text"');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTranscriptionEndpoint();