// Test script to debug the transcription API
const fetch = require('node-fetch');

async function testTranscriptionAPI() {
  try {
    console.log('🧪 Testing transcription API endpoint...');
    
    // Create a minimal base64 audio data for testing
    const testAudioData = Buffer.from('test audio data').toString('base64');
    
    const apiUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/audio/transcribe';
    
    console.log('🔧 Making request to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token' // This will fail auth but we can see the response structure
      },
      body: JSON.stringify({
        audioData: testAudioData,
        patientId: 'test-patient-id'
      })
    });
    
    console.log('📊 Response status:', response.status, response.statusText);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log('📊 Response data:', JSON.stringify(responseData, null, 2));
    
    // Test with a valid token (you'll need to get this from the browser console)
    console.log('\n🔐 To test with valid auth, copy a Bearer token from the browser console and run:');
    console.log('curl -X POST \\');
    console.log(`  "${apiUrl}" \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
    console.log('  -d \'{"audioData":"' + testAudioData.substring(0, 50) + '...","patientId":"test-patient"}\'');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTranscriptionAPI();