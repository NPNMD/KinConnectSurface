// Test the updated transcription API
const fetch = require('node-fetch');

async function testUpdatedTranscriptionAPI() {
  try {
    console.log('🧪 Testing updated transcription API...');
    
    // You'll need to get a valid Bearer token from the browser console
    // Look for a line like: Authorization: 'Bearer eyJhbGciOiJSUzI1NiIs...'
    const bearerToken = 'PASTE_TOKEN_HERE'; // Replace with actual token from browser
    
    if (bearerToken === 'PASTE_TOKEN_HERE') {
      console.log('❌ Please update the bearerToken variable with a real token from the browser console');
      console.log('📋 Steps to get token:');
      console.log('1. Open browser dev tools (F12)');
      console.log('2. Go to Console tab');
      console.log('3. Record audio in the visit summary form');
      console.log('4. Look for a line like: 🔧 Headers: {Content-Type: \'application/json\', Authorization: \'Bearer eyJ...\'}');
      console.log('5. Copy the Bearer token (everything after "Bearer ")');
      console.log('6. Paste it in this script and run again');
      return;
    }
    
    // Create test audio data (small WebM audio)
    const testAudioData = Buffer.from('test audio data for transcription').toString('base64');
    
    const apiUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/audio/transcribe';
    
    console.log('🔧 Making authenticated request to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: JSON.stringify({
        audioData: testAudioData,
        patientId: '3u7bMygdjIMdWEQxMZwW1DIw5zl1'
      })
    });
    
    console.log('📊 Response status:', response.status, response.statusText);
    
    const responseData = await response.json();
    console.log('📊 Response data:', JSON.stringify(responseData, null, 2));
    
    if (response.ok && responseData.success) {
      console.log('✅ API call successful!');
      if (responseData.data && responseData.data.transcription) {
        console.log('✅ Transcription received:', responseData.data.transcription);
        console.log('🎯 Confidence:', responseData.data.confidence);
      } else {
        console.log('⚠️ No transcription in response (expected for test data)');
      }
    } else {
      console.log('❌ API call failed:', responseData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUpdatedTranscriptionAPI();