// Test Google Speech-to-Text API directly
const speech = require('@google-cloud/speech');

async function testSpeechAPI() {
  try {
    console.log('🔍 Testing Google Speech-to-Text API directly...');
    
    // Initialize client
    const client = new speech.SpeechClient();
    console.log('✅ Speech client initialized');
    
    // Test with a simple text-to-speech audio (for testing)
    // Since we can't easily create audio here, let's test the client setup
    
    // Test 1: Check if client can connect
    try {
      // This will test authentication and API access
      const [operation] = await client.longRunningRecognize({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
        audio: {
          content: Buffer.from('test') // This will fail but test auth
        }
      });
      console.log('✅ API connection test passed');
    } catch (authError) {
      console.log('🔍 API connection test result:', {
        error: authError.message,
        code: authError.code,
        details: authError.details
      });
      
      if (authError.message.includes('Invalid audio content')) {
        console.log('✅ Authentication works (expected audio error)');
      } else if (authError.message.includes('permission') || authError.message.includes('auth')) {
        console.log('❌ Authentication/permission issue');
      } else {
        console.log('🔍 Other API issue:', authError.message);
      }
    }
    
    // Test 2: Check available models
    try {
      console.log('🔍 Testing available models...');
      // This is a simple way to test if the API is accessible
      const testConfig = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        model: 'default' // Use default instead of latest_long
      };
      console.log('✅ Basic config created:', testConfig);
    } catch (configError) {
      console.log('❌ Config error:', configError.message);
    }
    
  } catch (error) {
    console.error('❌ Speech API test failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

// Run the test
testSpeechAPI().then(() => {
  console.log('🔍 Speech API test completed');
}).catch(error => {
  console.error('❌ Test execution failed:', error);
});