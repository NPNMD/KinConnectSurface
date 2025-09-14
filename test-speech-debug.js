const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up credentials)
// This is just for testing the Speech-to-Text API directly

async function testSpeechToText() {
  try {
    console.log('🧪 Testing Google Speech-to-Text API...');
    
    // Import Google Speech-to-Text
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    
    console.log('✅ Speech client initialized');
    
    // Create a simple test audio buffer (silence)
    const testAudioBuffer = Buffer.alloc(1024, 0);
    
    const request = {
      audio: {
        content: testAudioBuffer,
      },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long',
        useEnhanced: true,
      },
    };
    
    console.log('🎤 Testing Speech-to-Text with config:', request.config);
    
    // Test the API
    const [response] = await client.recognize(request);
    
    console.log('✅ Speech-to-Text API response:', {
      resultsCount: response.results?.length || 0,
      results: response.results
    });
    
    if (response.results && response.results.length > 0) {
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
      
      console.log('📝 Transcription:', transcription);
      console.log('🎯 Confidence:', response.results[0]?.alternatives[0]?.confidence || 'N/A');
    } else {
      console.log('ℹ️ No transcription results (expected for silence)');
    }
    
  } catch (error) {
    console.error('❌ Speech-to-Text test failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack
    });
  }
}

// Test if the Speech-to-Text client can be initialized
async function testSpeechClientInit() {
  try {
    console.log('🔧 Testing Speech client initialization...');
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    console.log('✅ Speech client created successfully');
    
    // Test if we can access the API
    const projectId = await client.getProjectId();
    console.log('🏗️ Project ID:', projectId);
    
  } catch (error) {
    console.error('❌ Speech client initialization failed:', error);
    console.error('❌ This might indicate missing credentials or API not enabled');
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Speech-to-Text debugging tests...');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  await testSpeechClientInit();
  await testSpeechToText();
  
  console.log('🏁 Tests completed');
}

runTests().catch(console.error);